import { describe, expect, it } from "vitest";
import {
  kindsForService,
  RUN_SERVICES,
  type RunService,
  refineRunsByService,
  runServiceFromKind,
} from "@/lib/runs/service";

// ─── runServiceFromKind ───────────────────────────────────────────────────────

describe("runServiceFromKind", () => {
  // swarms
  it('maps "swarm" → "swarms"', () => {
    expect(runServiceFromKind("swarm")).toBe("swarms");
  });

  // helm
  it('maps "chat" → "helm"', () => {
    expect(runServiceFromKind("chat")).toBe("helm");
  });
  it('maps "workflow" → "helm"', () => {
    expect(runServiceFromKind("workflow")).toBe("helm");
  });
  it('maps "evaluation" → "helm"', () => {
    expect(runServiceFromKind("evaluation")).toBe("helm");
  });

  // jobs
  it('maps "image_gen" → "jobs"', () => {
    expect(runServiceFromKind("image_gen")).toBe("jobs");
  });
  it('maps "audio_gen" → "jobs"', () => {
    expect(runServiceFromKind("audio_gen")).toBe("jobs");
  });
  it('maps "video_gen" → "jobs"', () => {
    expect(runServiceFromKind("video_gen")).toBe("jobs");
  });
  it('maps "doc_parse" → "jobs"', () => {
    expect(runServiceFromKind("doc_parse")).toBe("jobs");
  });
  it('maps "code_exec" → "jobs"', () => {
    expect(runServiceFromKind("code_exec")).toBe("jobs");
  });

  // action — computer_action kind
  it('maps "computer_action" → "action"', () => {
    expect(runServiceFromKind("computer_action")).toBe("action");
  });

  // action — tool_test with computer-action event_id
  it('maps "tool_test" with event_id starting with "computer-action" → "action"', () => {
    expect(runServiceFromKind("tool_test", { event_id: "computer-action-abc-123" })).toBe("action");
  });

  it('maps "tool_test" with event_id "computer-action" (exact prefix) → "action"', () => {
    expect(runServiceFromKind("tool_test", { event_id: "computer-action" })).toBe("action");
  });

  // tool_test WITHOUT computer-action event_id → other
  it('maps "tool_test" without matching event_id → "other"', () => {
    expect(runServiceFromKind("tool_test", { event_id: "some-other-event" })).toBe("other");
  });

  it('maps "tool_test" with no metadata → "other"', () => {
    expect(runServiceFromKind("tool_test")).toBe("other");
  });

  it('maps "tool_test" with null metadata → "other"', () => {
    expect(runServiceFromKind("tool_test", null)).toBe("other");
  });

  it('maps "tool_test" with empty event_id → "other"', () => {
    expect(runServiceFromKind("tool_test", { event_id: "" })).toBe("other");
  });

  // other
  it('maps unknown kind → "other"', () => {
    expect(runServiceFromKind("unknown_kind_xyz")).toBe("other");
  });

  it('maps empty string → "other"', () => {
    expect(runServiceFromKind("")).toBe("other");
  });
});

// ─── kindsForService ──────────────────────────────────────────────────────────

describe("kindsForService", () => {
  it('"swarms" returns ["swarm"]', () => {
    expect(kindsForService("swarms")).toEqual(["swarm"]);
  });

  it('"action" returns ["computer_action", "tool_test"]', () => {
    expect(kindsForService("action")).toEqual(["computer_action", "tool_test"]);
  });

  it('"jobs" returns all job kinds', () => {
    expect(kindsForService("jobs")).toEqual([
      "image_gen",
      "audio_gen",
      "video_gen",
      "doc_parse",
      "code_exec",
    ]);
  });

  it('"helm" returns ["chat", "workflow", "evaluation"]', () => {
    expect(kindsForService("helm")).toEqual(["chat", "workflow", "evaluation"]);
  });

  it('"other" returns ["tool_test"]', () => {
    expect(kindsForService("other")).toEqual(["tool_test"]);
  });
});

// ─── RUN_SERVICES constant ────────────────────────────────────────────────────

describe("RUN_SERVICES", () => {
  it("contains exactly 5 services", () => {
    expect(RUN_SERVICES).toHaveLength(5);
  });

  it("contains all expected values", () => {
    expect(RUN_SERVICES).toContain("swarms");
    expect(RUN_SERVICES).toContain("action");
    expect(RUN_SERVICES).toContain("helm");
    expect(RUN_SERVICES).toContain("jobs");
    expect(RUN_SERVICES).toContain("other");
  });
});

// ─── Round-trip: kindsForService → runServiceFromKind ─────────────────────────

describe("round-trip: kindsForService → runServiceFromKind", () => {
  const services: RunService[] = ["swarms", "action", "helm", "jobs"];

  for (const svc of services) {
    it(`all candidate kinds for "${svc}" resolve back to "${svc}" (non-ambiguous cases)`, () => {
      const kinds = kindsForService(svc);
      for (const k of kinds) {
        // Skip tool_test for action — it requires metadata to resolve unambiguously
        if (svc === "action" && k === "tool_test") continue;
        expect(runServiceFromKind(k)).toBe(svc);
      }
    });
  }

  it('tool_test with computer-action metadata resolves to "action" (action round-trip)', () => {
    expect(runServiceFromKind("tool_test", { event_id: "computer-action-xyz" })).toBe("action");
  });

  it('"other" has 1 DB kind (tool_test) — runServiceFromKind("other") → "other"', () => {
    expect(kindsForService("other")).toHaveLength(1);
    expect(runServiceFromKind("other")).toBe("other");
  });
});

// ─── refineRunsByService ──────────────────────────────────────────────────────

describe("refineRunsByService", () => {
  type MockRow = { kind: string; metadata: Record<string, unknown> | null };

  const rows: MockRow[] = [
    { kind: "tool_test", metadata: { event_id: "computer-action-1" } },
    { kind: "tool_test", metadata: { event_id: "manual-xyz" } },
    { kind: "swarm", metadata: {} },
  ];

  it('filter by "other" keeps only tool_test without computer-action event_id', () => {
    const result = refineRunsByService(
      rows,
      "other",
      (r) => r.kind,
      (r) => r.metadata,
    );
    expect(result).toHaveLength(1);
    expect(result[0].metadata?.event_id).toBe("manual-xyz");
  });

  it('filter by "action" keeps only tool_test with computer-action event_id', () => {
    const result = refineRunsByService(
      rows,
      "action",
      (r) => r.kind,
      (r) => r.metadata,
    );
    expect(result).toHaveLength(1);
    expect(result[0].metadata?.event_id).toBe("computer-action-1");
  });

  it("null service returns all rows", () => {
    const result = refineRunsByService(
      rows,
      null,
      (r) => r.kind,
      (r) => r.metadata,
    );
    expect(result).toHaveLength(3);
  });

  it("undefined service returns all rows", () => {
    const result = refineRunsByService(
      rows,
      undefined,
      (r) => r.kind,
      (r) => r.metadata,
    );
    expect(result).toHaveLength(3);
  });
});
