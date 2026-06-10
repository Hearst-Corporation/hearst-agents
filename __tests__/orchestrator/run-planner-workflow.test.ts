/**
 * Mission Control B1 — run-planner-workflow tests.
 *
 * Couvre :
 * - Détection complex intent (heuristique)
 * - Feature flag isPlannerEnabled
 * - Plan multi-step → events émis dans l'ordre
 * - Plan paused sur approval gate
 * - createPlanFromIntentAsync : LLM path + fallback regex
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock generateStepsLLM so runPlannerWorkflow never hits a real LLM ────────
// Dynamic import in createPlanFromIntentAsync means we mock the module.
const mockGenerateStepsLLM = vi.fn();

vi.mock("@/lib/engine/planner/llm-steps", () => ({
  generateStepsLLM: (...args: unknown[]) => mockGenerateStepsLLM(...args),
}));

import {
  buildPreview,
  isComplexIntent,
  isPlannerEnabled,
  runPlannerWorkflow,
} from "@/lib/engine/orchestrator/run-planner-workflow";
import type { InferredStep } from "@/lib/engine/planner";
import { createPlanFromIntentAsync } from "@/lib/engine/planner";
import { clearAllPlannerStores } from "@/lib/engine/planner/store";
import { RunEventBus } from "@/lib/events/bus";
import type { RunEvent } from "@/lib/events/types";

// ── Helpers ──────────────────────────────────────────────────

function makeMockEngine(runId = "run_test_42") {
  return {
    id: runId,
    runId,
    userId: "user_test",
    complete: vi.fn().mockResolvedValue(undefined),
    fail: vi.fn().mockResolvedValue(undefined),
  } as unknown as Parameters<typeof runPlannerWorkflow>[0];
}

function collectEvents(bus: RunEventBus): RunEvent[] {
  const events: RunEvent[] = [];
  bus.on((e) => {
    events.push(e);
  });
  return events;
}

// ── buildPreview ─────────────────────────────────────────────

describe("buildPreview", () => {
  it("returns English label prefixed with kind verb + step title", () => {
    const step = {
      id: "step-1",
      kind: "deliver" as const,
      title: "Send weekly report",
      dependsOn: [],
      risk: "high" as const,
      status: "pending" as const,
    };
    const preview = buildPreview(step);
    expect(preview).toBe("Send: Send weekly report");
    expect(preview).not.toMatch(/intent/i);
  });

  it("never includes raw intent text", () => {
    const step = {
      id: "step-2",
      kind: "analyze" as const,
      title: "Analyse customer feedback",
      dependsOn: [],
      risk: "low" as const,
      status: "pending" as const,
    };
    const rawIntent = "create a multi-step plan: draft a report and send to the board";
    // buildPreview does not accept intent — confirm signature takes 1 arg
    const preview = buildPreview(step);
    expect(preview).not.toContain(rawIntent);
    expect(preview).toContain("Analyse customer feedback");
  });

  it("produces English output for all known kinds", () => {
    const kinds = [
      "read",
      "analyze",
      "synthesize",
      "generate_asset",
      "deliver",
      "schedule",
      "monitor",
      "wait_for_approval",
    ] as const;
    for (const kind of kinds) {
      const step = {
        id: `step-${kind}`,
        kind,
        title: "Do something important",
        dependsOn: [],
        risk: "low" as const,
        status: "pending" as const,
      };
      const preview = buildPreview(step);
      expect(preview).toMatch(/^[A-Z][a-z]+: /);
      expect(preview.length).toBeLessThanOrEqual(140);
    }
  });

  it("truncates long titles to ≤ 140 chars", () => {
    const step = {
      id: "step-long",
      kind: "synthesize" as const,
      title: "A".repeat(200),
      dependsOn: [],
      risk: "low" as const,
      status: "pending" as const,
    };
    const preview = buildPreview(step);
    expect(preview.length).toBeLessThanOrEqual(140);
    expect(preview.endsWith("...")).toBe(true);
  });
});

// ── isComplexIntent ──────────────────────────────────────────

describe("isComplexIntent", () => {
  it("returns false for short messages", () => {
    expect(isComplexIntent("Bonjour")).toBe(false);
    expect(isComplexIntent("Quelle heure est-il ?")).toBe(false);
  });

  it("returns false for long but trivial messages", () => {
    expect(
      isComplexIntent(
        "Voici un message bien plus long que quatre-vingts caractères mais sans aucun mot clé déclencheur particulier ici",
      ),
    ).toBe(false);
  });

  it("returns true for long messages with complex keyword", () => {
    expect(
      isComplexIntent(
        "Prépare le board pack Q2 avec les KPIs commerciaux et les retours clients pour la prochaine réunion",
      ),
    ).toBe(true);
  });

  it("returns true for English board pack request", () => {
    expect(
      isComplexIntent(
        "Please prepare the board pack for Q2 with commercial KPIs and customer feedback for next meeting",
      ),
    ).toBe(true);
  });

  it("returns true for multi-domain hint", () => {
    expect(
      isComplexIntent(
        "Synthétise les emails de la semaine et envoie un résumé sur le canal #equipe-direction immédiatement",
      ),
    ).toBe(true);
  });
});

// ── isPlannerEnabled ─────────────────────────────────────────

describe("isPlannerEnabled", () => {
  const original = process.env.HEARST_ENABLE_PLANNER;

  afterEach(() => {
    if (original === undefined) delete process.env.HEARST_ENABLE_PLANNER;
    else process.env.HEARST_ENABLE_PLANNER = original;
  });

  it("returns true when HEARST_ENABLE_PLANNER=true", () => {
    process.env.HEARST_ENABLE_PLANNER = "true";
    expect(isPlannerEnabled()).toBe(true);
  });

  it("returns true when HEARST_ENABLE_PLANNER=1", () => {
    process.env.HEARST_ENABLE_PLANNER = "1";
    expect(isPlannerEnabled()).toBe(true);
  });

  it("returns false when HEARST_ENABLE_PLANNER=false", () => {
    process.env.HEARST_ENABLE_PLANNER = "false";
    expect(isPlannerEnabled()).toBe(false);
  });
});

// ── createPlanFromIntentAsync ────────────────────────────────

describe("createPlanFromIntentAsync", () => {
  beforeEach(() => {
    clearAllPlannerStores();
    mockGenerateStepsLLM.mockReset();
  });

  const baseInput = {
    intent: "envoie un rapport à l'équipe",
    threadId: "thread-async-1",
    userId: "user_async",
    tenantId: "tenant_async",
    workspaceId: "ws_async",
  };

  it("uses LLM steps when generateStepsLLM returns steps", async () => {
    const llmSteps: InferredStep[] = [
      { kind: "analyze", title: "Analyse LLM", expectedOutput: "analysis" },
      {
        kind: "deliver",
        title: "Livraison",
        capability: "messaging_send",
        tool: "send_message",
        expectedOutput: "confirmation",
      },
    ];
    mockGenerateStepsLLM.mockResolvedValue(llmSteps);

    const plan = await createPlanFromIntentAsync(baseInput);

    // LLM steps were used (deliver → high-risk → gate inserted)
    const kinds = plan.steps.map((s) => s.kind);
    expect(kinds).toContain("analyze");
    expect(kinds).toContain("deliver");
  });

  it("deliver step (high-risk send) triggers wait_for_approval gate + requiresApproval", async () => {
    const llmSteps: InferredStep[] = [
      { kind: "analyze", title: "Analyse", expectedOutput: "analysis" },
      {
        kind: "deliver",
        title: "Envoi",
        capability: "messaging_send",
        tool: "send_message",
        expectedOutput: "confirmation",
      },
    ];
    mockGenerateStepsLLM.mockResolvedValue(llmSteps);

    const plan = await createPlanFromIntentAsync({
      ...baseInput,
      // intent with HIGH_RISK keyword so assessRisk → "high" on deliver
      intent: "envoie un email au team lead",
    });

    expect(plan.requiresApproval).toBe(true);
    expect(plan.approvalStepId).toBeDefined();
    const gate = plan.steps.find((s) => s.kind === "wait_for_approval");
    expect(gate).toBeDefined();
  });

  it("falls back to regex inferSteps when generateStepsLLM returns null", async () => {
    mockGenerateStepsLLM.mockResolvedValue(null);

    const plan = await createPlanFromIntentAsync({
      ...baseInput,
      intent: "résume mes emails de la semaine",
    });

    // Regex inferSteps should produce at least a read + analyze
    expect(plan.steps.length).toBeGreaterThan(0);
    const kinds = plan.steps.map((s) => s.kind);
    expect(kinds).toContain("read"); // résume/emails triggers read
  });

  it("sync createPlanFromIntent and async createPlanFromIntentAsync (null LLM) produce same step kinds", async () => {
    mockGenerateStepsLLM.mockResolvedValue(null);

    const { createPlanFromIntent } = await import("@/lib/engine/planner");
    const intent = "synthétise un brief pour le board";
    const sharedInput = {
      intent,
      threadId: "t1",
      userId: "u1",
      tenantId: "tenant1",
      workspaceId: "ws1",
    };

    const syncPlan = createPlanFromIntent(sharedInput);
    const asyncPlan = await createPlanFromIntentAsync(sharedInput);

    const syncKinds = syncPlan.steps.map((s) => s.kind).sort();
    const asyncKinds = asyncPlan.steps.map((s) => s.kind).sort();
    expect(asyncKinds).toEqual(syncKinds);
  });
});

// ── runPlannerWorkflow ───────────────────────────────────────

describe("runPlannerWorkflow", () => {
  beforeEach(() => {
    clearAllPlannerStores();
    // Default: LLM returns null → regex fallback (safe, no real LLM call)
    mockGenerateStepsLLM.mockResolvedValue(null);
  });

  it("emits plan_preview with steps and cost", async () => {
    const bus = new RunEventBus();
    const events = collectEvents(bus);
    const engine = makeMockEngine();

    await runPlannerWorkflow(engine, bus, {
      userId: "user_test",
      tenantId: "tenant_test",
      workspaceId: "ws_test",
      threadId: "thread_test",
      message:
        "Prépare un rapport hebdomadaire à partir des emails et envoie-le au team lead pour validation",
      connectedProviders: [],
    });

    const preview = events.find((e) => e.type === "plan_preview");
    expect(preview).toBeDefined();
    expect((preview as { steps: unknown[] }).steps.length).toBeGreaterThan(0);
    expect((preview as { estimatedCostUsd: number }).estimatedCostUsd).toBeGreaterThanOrEqual(0);
  });

  it("emits plan_step_started + plan_step_completed pour chaque step", async () => {
    const bus = new RunEventBus();
    const events = collectEvents(bus);
    const engine = makeMockEngine();

    await runPlannerWorkflow(engine, bus, {
      userId: "user_test",
      tenantId: "tenant_test",
      workspaceId: "ws_test",
      threadId: "thread_test",
      message: "Analyse cette semaine et synthétise un brief court pour l'équipe",
      connectedProviders: [],
    });

    const started = events.filter((e) => e.type === "plan_step_started");
    const completed = events.filter((e) => e.type === "plan_step_completed");
    expect(started.length).toBeGreaterThan(0);
    expect(completed.length).toBeGreaterThan(0);
  });

  it("emits plan_run_complete with total cost", async () => {
    const bus = new RunEventBus();
    const events = collectEvents(bus);
    const engine = makeMockEngine();

    await runPlannerWorkflow(engine, bus, {
      userId: "user_test",
      tenantId: "tenant_test",
      workspaceId: "ws_test",
      threadId: "thread_test",
      message: "Synthétise les retours clients de la semaine en un brief actionnable",
      connectedProviders: [],
    });

    const complete = events.find((e) => e.type === "plan_run_complete");
    expect(complete).toBeDefined();
    expect((complete as { totalCostUsd: number }).totalCostUsd).toBeGreaterThanOrEqual(0);
  });

  it("emits plan_step_awaiting_approval when intent demande validation", async () => {
    const bus = new RunEventBus();
    const events = collectEvents(bus);
    const engine = makeMockEngine();

    const result = await runPlannerWorkflow(engine, bus, {
      userId: "user_test",
      tenantId: "tenant_test",
      workspaceId: "ws_test",
      threadId: "thread_test",
      // POURQUOI : intent qui DOIT créer une approval gate sans dépendre d'un
      // provider externe : on force "vérifie avant" + analyse pour rester
      // sur des steps internes qui n'ont pas besoin de resolveCapability.
      message:
        "Synthétise un brief pour le board mais vérifie avant de finaliser le rapport stratégique pour validation",
      connectedProviders: [],
    });

    const awaiting = events.find((e) => e.type === "plan_step_awaiting_approval");
    expect(awaiting).toBeDefined();
    expect(result.paused).toBe(true);
  });

  it("uses LLM steps when generateStepsLLM returns non-null", async () => {
    const llmSteps: InferredStep[] = [
      { kind: "read", title: "Lecture LLM", capability: "messaging", expectedOutput: "messages" },
      { kind: "synthesize", title: "Synthèse LLM", expectedOutput: "summary" },
    ];
    mockGenerateStepsLLM.mockResolvedValue(llmSteps);

    const bus = new RunEventBus();
    const events = collectEvents(bus);
    const engine = makeMockEngine();

    await runPlannerWorkflow(engine, bus, {
      userId: "user_test",
      tenantId: "tenant_test",
      workspaceId: "ws_test",
      threadId: "thread_test",
      message: "Résume les messages Slack et envoie un brief",
      connectedProviders: [],
    });

    const preview = events.find((e) => e.type === "plan_preview") as
      | { steps: Array<{ kind: string }> }
      | undefined;
    expect(preview).toBeDefined();
    const previewKinds = preview!.steps.map((s) => s.kind);
    // LLM steps: read + synthesize should appear
    expect(previewKinds).toContain("read");
    expect(previewKinds).toContain("synthesize");
  });
});
