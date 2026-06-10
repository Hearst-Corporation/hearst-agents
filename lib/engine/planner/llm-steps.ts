/**
 * LLM-based step generation for the planner.
 *
 * Replaces the regex `inferSteps` heuristic with a gpt-4o call that produces
 * atomic, structured steps. Falls back to null on any failure so that the
 * caller can use the regex fallback transparently.
 */

import { PLANNER_MODEL, PLANNER_PROVIDER } from "@/lib/engine/orchestrator/system-prompt";
import { chatWithCircuitBreaker } from "@/lib/llm/safe-chat";
import type { InferredStep } from "./index";
import type { ExecutionPlanType, PlanStepKind } from "./types";

// ── Valid PlanStepKind set (source of truth: types.ts) ────────

const VALID_KINDS: ReadonlySet<PlanStepKind> = new Set<PlanStepKind>([
  "read",
  "analyze",
  "synthesize",
  "generate_asset",
  "deliver",
  "schedule",
  "monitor",
  "wait_for_approval",
]);

function isValidKind(kind: unknown): kind is PlanStepKind {
  return typeof kind === "string" && VALID_KINDS.has(kind as PlanStepKind);
}

// ── System prompt ──────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a planner that converts user intent into atomic execution steps.

Output ONLY valid JSON — no markdown fences, no extra text.

Schema:
{
  "steps": [
    {
      "kind": "<PlanStepKind>",
      "title": "<short human-readable title>",
      "capability": "<string or null>",
      "tool": "<string or null>",
      "expectedOutput": "<string>"
    }
  ]
}

PlanStepKind must be one of exactly: read, analyze, synthesize, generate_asset, deliver, schedule, monitor, wait_for_approval.

Rules:
- "deliver" = side-effect step (send/publish/post). Use for sending emails, messages, publishing.
- "generate_asset" = produces a deliverable artifact (PDF, report, document).
- "wait_for_approval" is reserved for the planner gate — do NOT include it in your output.
- 1 to 6 steps maximum, in execution order.
- Do NOT invent capabilities. If no capability applies, set "capability": null.
- "title" is required, must be concise (≤ 60 chars), and MUST be written in English.
- All user-facing text in the output (title, expectedOutput) must be in English.
- Use the plan type context: one_shot = single execution; mission = recurring; monitoring = event-driven watch.`;

// ── Raw step shape from JSON ───────────────────────────────────

interface RawStep {
  kind: unknown;
  title: unknown;
  capability?: unknown;
  tool?: unknown;
  expectedOutput?: unknown;
}

// ── Strip fences ───────────────────────────────────────────────

function stripFences(text: string): string {
  // Remove ```json ... ``` or ``` ... ``` wrappers that gpt-4o may include.
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

// ── LLM result discriminated union ────────────────────────────

type LLMResult = { ok: false } | { ok: true; content: string };

// ── Main export ────────────────────────────────────────────────

/**
 * Generate plan steps via gpt-4o. Returns null on any failure (invalid JSON,
 * 0 valid steps, circuit open, LLM error) so the caller can fall back to
 * `inferSteps`.
 */
export async function generateStepsLLM(
  intent: string,
  type: ExecutionPlanType,
): Promise<InferredStep[] | null> {
  const fallback: LLMResult = { ok: false };

  const result = await chatWithCircuitBreaker<LLMResult>({
    provider: PLANNER_PROVIDER,
    context: "planner/llm-steps",
    chatRequest: {
      model: PLANNER_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Plan type: ${type}\nUser intent: ${intent}`,
        },
      ],
      max_tokens: 1024,
      temperature: 0,
    },
    fallback,
    parse: (res): LLMResult => ({ ok: true, content: res.content }),
  });

  // Circuit open or LLM error → signal fallback
  if (!result.ok) return null;

  // Parse JSON (strip fences defensively)
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFences(result.content));
  } catch {
    return null;
  }

  // Validate shape
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !Array.isArray((parsed as Record<string, unknown>).steps)
  ) {
    return null;
  }

  const rawSteps = (parsed as { steps: RawStep[] }).steps;

  // Map + strict kind validation — drop invalid entries
  const valid: InferredStep[] = rawSteps
    .filter((s): boolean => isValidKind(s.kind))
    .map((s) => ({
      kind: s.kind as PlanStepKind,
      title: typeof s.title === "string" && s.title.trim().length > 0 ? s.title.trim() : "Step",
      capability: typeof s.capability === "string" ? s.capability : undefined,
      tool: typeof s.tool === "string" ? s.tool : undefined,
      expectedOutput: typeof s.expectedOutput === "string" ? s.expectedOutput : undefined,
    }));

  // 0 valid steps → signal fallback
  if (valid.length === 0) return null;

  return valid;
}
