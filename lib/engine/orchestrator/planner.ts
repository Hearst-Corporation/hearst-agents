/**
 * Orchestrator Planner — Transforms user intent into a structured Plan.
 *
 * Uses Claude tool-calling to produce either:
 * - A Plan with steps (complex tasks)
 * - A direct text response (simple tasks)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type Domain,
  getValidAgentsForDomain,
  isAgentValidForDomain,
} from "@/lib/capabilities/taxonomy";
import type { RunEngine } from "@/lib/engine/runtime/engine";
import { PlanStore } from "@/lib/engine/runtime/plans/store";
import type { Plan, PlanStep } from "@/lib/engine/runtime/plans/types";
import { defaultMetrics } from "@/lib/llm/metrics";
import { chatWithCircuitBreaker } from "@/lib/llm/safe-chat";
import type { ChatMessage } from "@/lib/llm/types";
import { ORCHESTRATOR_MODEL, ORCHESTRATOR_SYSTEM_PROMPT } from "./system-prompt";

export type PlanningResult =
  | { kind: "plan"; plan: Plan }
  | { kind: "direct_response"; text: string }
  | { kind: "request_connection"; app: string; reason: string }
  | { kind: "error"; error: string };

interface PlanStepFromLLM {
  intent: string;
  agent: string;
  task_description: string;
  expected_output: string;
  retrieval_mode?: string;
  needs_artifact?: boolean;
  optional?: boolean;
  depends_on?: number[];
}

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export interface PlanFromIntentOptions {
  surface?: string;
  capabilityDomain?: string;
  /**
   * Per-user Composio action slugs (e.g. "GMAIL_SEND_EMAIL", "SLACKBOT_…").
   * When present, the planner gets an extra system block listing the
   * user's actually-available actions plus the draft-first write rule.
   * The static prompt stays cached; this dynamic suffix is sent uncached
   * (small relative cost, full per-user awareness).
   */
  discoveredActions?: string[];
  /** Tenant identifier — propagé au circuit breaker (clé per-tenant Phase 5). */
  tenantId?: string;
  /** User identifier — pour les métriques et le rate limiter. */
  userId?: string;
}

export async function planFromIntent(
  db: SupabaseClient,
  engine: RunEngine,
  userMessage: string,
  conversationHistory: ConversationMessage[],
  surfaceOrOptions?: string | PlanFromIntentOptions,
  capabilityDomainArg?: string,
): Promise<PlanningResult> {
  // Backward compatibility: accept (..., surface, capabilityDomain) OR
  // (..., options). Internal callers should migrate to the options form.
  const opts: PlanFromIntentOptions =
    typeof surfaceOrOptions === "object" && surfaceOrOptions !== null
      ? surfaceOrOptions
      : { surface: surfaceOrOptions, capabilityDomain: capabilityDomainArg };

  const { surface, capabilityDomain, discoveredActions } = opts;

  const chatMessages: ChatMessage[] = [
    { role: "system", content: ORCHESTRATOR_SYSTEM_PROMPT },
    ...conversationHistory.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    {
      role: "user" as const,
      content: buildUserPrompt(userMessage, surface),
    },
  ];

  const dynamicSuffix = buildDynamicSystemSuffix(discoveredActions ?? []);
  if (dynamicSuffix) {
    chatMessages.push({ role: "system", content: dynamicSuffix });
  }

  // Convert Anthropic-style tools (input_schema) to OpenAI function tools
  // KimiProvider.chat() utilise messages sans tool_calls — on passe les outils
  // via le prompt system (suffix) plutôt que via un paramètre tools dédié.
  // Pour conserver la compatibilité du parsing de réponse, on utilise
  // chatWithCircuitBreaker (helper safe-chat) qui wrappe breaker + getProvider.
  //
  // Note: ChatRequest ne supporte pas nativement tool_choice/tools —
  // le modèle Kimi produit du JSON structuré à partir du system prompt.
  type LlmOk = {
    ok: true;
    content: string;
    tokens_in: number;
    tokens_out: number;
    latency_ms: number;
  };
  type LlmFail = { ok: false };
  const FAILED: LlmFail = { ok: false };

  const llmResult = await chatWithCircuitBreaker<LlmOk | LlmFail>({
    tenantId: opts.tenantId,
    context: "orchestrator/planner",
    chatRequest: {
      model: ORCHESTRATOR_MODEL,
      messages: chatMessages,
      max_tokens: 4096,
      temperature: 0,
    },
    fallback: FAILED,
    parse: (res) => ({
      ok: true as const,
      content: res.content,
      tokens_in: res.tokens_in,
      tokens_out: res.tokens_out,
      latency_ms: res.latency_ms,
    }),
  });

  if (!llmResult.ok) {
    const msg = "[Planner] kimi indisponible (circuit ouvert ou erreur LLM) — requête annulée";
    console.error(msg);
    defaultMetrics.recordError({ provider: "kimi", errorCode: "LLM_ERROR" });
    return { kind: "error", error: msg };
  }

  const llmResponse = llmResult;
  defaultMetrics.recordCall({
    provider: "kimi",
    model: ORCHESTRATOR_MODEL,
    latencyMs: llmResponse.latency_ms,
    tokensIn: llmResponse.tokens_in,
    tokensOut: llmResponse.tokens_out,
  });

  await engine.cost.track({
    input_tokens: llmResponse.tokens_in,
    output_tokens: llmResponse.tokens_out,
    tool_calls: 0,
    latency_ms: llmResponse.latency_ms,
  });

  // Planner uses the model's text response to extract tool call JSON.
  // The KimiProvider returns content as plain text; we parse tool_calls
  // from a structured JSON block the model emits inside the response.
  const responseContent = llmResponse.content;

  // Attempt to parse as JSON tool call block produced by Kimi with system prompt guidance.
  let toolCall: { function: { name: string; arguments: string } } | undefined;
  let rawContent: string | undefined;
  try {
    // Kimi (via hypercli) returns structured JSON for tool calls in the content
    // field when system-prompted with tool schemas, formatted as:
    // { "tool_calls": [{ "function": { "name": "...", "arguments": "..." } }] }
    // or as a raw text_response when no tool is needed.
    const parsed = JSON.parse(responseContent) as {
      tool_calls?: Array<{ function: { name: string; arguments: string } }>;
      content?: string;
    };
    toolCall = parsed.tool_calls?.[0];
    rawContent = parsed.content;
  } catch {
    // Not JSON — treat as a direct text response.
    rawContent = responseContent;
  }

  const message = {
    content: rawContent,
    tool_calls: toolCall ? [{ function: toolCall.function }] : undefined,
  };

  if (!toolCall) {
    return { kind: "direct_response", text: message?.content || "OK" };
  }

  // ── Inline app connect request ────────────────────────────
  if (toolCall.function.name === "request_connection") {
    const input = JSON.parse(toolCall.function.arguments) as { app: string; reason: string };
    return {
      kind: "request_connection",
      app: input.app.toLowerCase(),
      reason: input.reason,
    };
  }

  // ── Direct response ──────────────────────────────────────
  if (toolCall.function.name === "text_response") {
    const input = JSON.parse(toolCall.function.arguments) as { text: string };
    return { kind: "direct_response", text: input.text };
  }

  // ── Plan creation ────────────────────────────────────────
  if (toolCall.function.name === "create_plan") {
    const input = JSON.parse(toolCall.function.arguments) as {
      reasoning: string;
      steps: PlanStepFromLLM[];
    };

    if (!input.steps || input.steps.length === 0) {
      return {
        kind: "direct_response",
        text: input.reasoning || "Tâche comprise, aucune action nécessaire.",
      };
    }

    const planSteps: Omit<
      PlanStep,
      "id" | "plan_id" | "status" | "run_step_id" | "completed_at"
    >[] = input.steps.map((s, i) => {
      let agent = s.agent;

      if (capabilityDomain && !isAgentValidForDomain(agent, capabilityDomain as Domain)) {
        const validAgents = getValidAgentsForDomain(capabilityDomain as Domain);
        const fallback = validAgents[0] ?? "KnowledgeRetriever";
        console.warn(
          `[Planner] Agent "${agent}" invalid for domain "${capabilityDomain}" — remapped to "${fallback}"`,
        );
        agent = fallback;
      }

      return {
        order: i + 1,
        intent: s.intent,
        agent,
        task_description: s.task_description,
        expected_output: s.expected_output,
        retrieval_mode: s.retrieval_mode,
        depends_on: (s.depends_on ?? []).map(String),
        optional: s.optional ?? false,
      };
    });

    const store = new PlanStore(db);
    const plan = await store.createPlan(engine.id, input.reasoning, planSteps);

    await engine.attachPlanId(plan.id, plan.steps.length);

    return { kind: "plan", plan };
  }

  return { kind: "error", error: `Unknown tool: ${toolCall.function.name}` };
}

function buildUserPrompt(message: string, surface?: string): string {
  let prompt = message;
  if (surface) {
    prompt = `[Surface active: ${surface}]\n\n${message}`;
  }
  return prompt;
}

/**
 * Per-turn system suffix listing the actions the *current user* has connected
 * via Composio, plus the draft-first safety rule for any write op.
 *
 * Why this is a SEPARATE system block (not merged into ORCHESTRATOR_SYSTEM_PROMPT):
 * - The static prompt is cached (`ephemeral` 5-min TTL). Inlining per-user
 *   data would invalidate the cache on every user switch.
 * - Splitting keeps the cached prefix big and stable while the dynamic
 *   suffix stays small (truncated to 80 names + a regex-based safety rule).
 *
 * Returns null when there are no discovered actions (skip the empty block).
 */
function buildDynamicSystemSuffix(discoveredActions: string[]): string | null {
  const WRITE_PATTERN = /(SEND|CREATE|UPDATE|DELETE|POST|REPLY|FORWARD|REVOKE|REFUND)/i;
  const writeActions = discoveredActions.filter((a) => WRITE_PATTERN.test(a));

  const parts: string[] = [];

  // ── Connected actions overview ──────────────────────────────
  if (discoveredActions.length > 0) {
    const previewLimit = 80;
    const preview = discoveredActions.slice(0, previewLimit);
    const overflow =
      discoveredActions.length > previewLimit
        ? ` (+${discoveredActions.length - previewLimit} more not listed)`
        : "";
    parts.push(
      `🔌 USER-CONNECTED ACTIONS (Composio, ${discoveredActions.length} total${overflow})`,
    );
    parts.push(
      `These are real API actions exposed by the apps THIS user has connected. Use them when planning steps that need a third-party effect:\n${preview.join(", ")}`,
    );
  } else {
    parts.push(
      `🔌 USER-CONNECTED ACTIONS: none yet. The user has not connected any third-party app via Composio.`,
    );
  }

  // ── Inline-connect tool guidance ────────────────────────────
  // Derive the set of "app prefixes" the user has connected so we can
  // tell the LLM unambiguously which apps trigger request_connection.
  const connectedAppPrefixes = new Set(
    discoveredActions.map((a) => a.split("_")[0]?.toLowerCase()).filter(Boolean) as string[],
  );
  const connectedList = [...connectedAppPrefixes].join(", ") || "(none)";
  parts.push(
    `🔗 INLINE CONNECT — request_connection tool
Use \`request_connection\` (instead of \`create_plan\` or \`text_response\`) when:
- The user explicitly asks to do something via a third-party service (Slack, Notion, GitHub, HubSpot, …)
- AND that service is NOT in the connected apps list above
Currently connected app prefixes: ${connectedList}
DO NOT use \`request_connection\` for Google read-only data (Gmail/Calendar/Drive) — those are handled natively even without a Composio connection.
The user will see a one-click "Connecter <app>" card in the chat. After they connect, they'll re-ask and you can fulfil the action.`,
  );

  // ── Write-op safety rule (only meaningful if we have write access) ──
  if (writeActions.length > 0) {
    parts.push(
      `⚠️ WRITE ACTIONS DETECTED: ${writeActions.slice(0, 30).join(", ")}${writeActions.length > 30 ? ", …" : ""}`,
    );
    parts.push(
      `Rule for ANY action that mutates the user's accounts (send / create / update / delete / post / reply / forward / revoke / refund):
1. NEVER call a write action until the user has explicitly approved the exact payload.
2. Present a clear draft (recipient/target, subject/title, body/payload) and ask "Confirmer l'envoi ?" or equivalent.
3. Only after explicit confirmation ("oui", "envoie", "go", "confirme", or similar) emit the action step.
4. If the user wants changes, revise and re-confirm BEFORE the action step.
This protects the user from irreversible side effects and is non-negotiable.`,
    );
  }

  return parts.join("\n\n");
}
