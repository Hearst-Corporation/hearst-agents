/**
 * Orchestrator Planner — Transforms user intent into a structured Plan.
 *
 * Uses Claude tool-calling to produce either:
 * - A Plan with steps (complex tasks)
 * - A direct text response (simple tasks)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import {
  type Domain,
  getValidAgentsForDomain,
  isAgentValidForDomain,
} from "@/lib/capabilities/taxonomy";
import type { RunEngine } from "@/lib/engine/runtime/engine";
import { PlanStore } from "@/lib/engine/runtime/plans/store";
import type { Plan, PlanStep } from "@/lib/engine/runtime/plans/types";
import {
  ORCHESTRATOR_MODEL,
  ORCHESTRATOR_SYSTEM_PROMPT,
  PLAN_TOOL,
  REQUEST_CONNECTION_TOOL,
  RESPOND_TOOL,
} from "./system-prompt";

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

  const client = new OpenAI({
    apiKey: process.env.KIMI_API_KEY!,
    baseURL: "https://api.moonshot.cn/v1",
  });

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
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
    messages.push({ role: "system", content: dynamicSuffix });
  }

  // Convert Anthropic-style tools (input_schema) to OpenAI function tools
  const tools: OpenAI.Chat.ChatCompletionTool[] = [
    PLAN_TOOL,
    RESPOND_TOOL,
    REQUEST_CONNECTION_TOOL,
  ].map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    },
  }));

  let response: OpenAI.Chat.Completions.ChatCompletion;
  try {
    response = await client.chat.completions.create({
      model: ORCHESTRATOR_MODEL,
      max_tokens: 4096,
      messages,
      tools,
      tool_choice: "auto",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown LLM error";
    console.error("[Orchestrator/Planner] LLM error:", msg);
    return { kind: "error", error: msg };
  }

  const usage = response.usage;
  await engine.cost.track({
    input_tokens: usage?.prompt_tokens ?? 0,
    output_tokens: usage?.completion_tokens ?? 0,
    tool_calls: 0,
    latency_ms: 0,
  });

  const message = response.choices[0]?.message;
  const toolCall = message?.tool_calls?.[0] as
    | { function: { name: string; arguments: string } }
    | undefined;

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
