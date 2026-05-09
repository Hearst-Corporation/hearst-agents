/**
 * Smoke tests pour le trust engine HOM.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { computeTrust } = await import("@/lib/hom/trust");
const { _internal } = await import("@/lib/hom/master");

describe("trust engine", () => {
  it("starts at 100 with no findings", async () => {
    const { after } = await computeTrust({
      runId: "test-1",
      agentResults: [],
      driftFindings: 0,
      retries: 0,
      quarantinedAgents: 0,
    });
    expect(after.architecture).toBe(100);
    expect(after.design).toBe(100);
    expect(after.qa).toBe(100);
    expect(after.release).toBe(100);
  });

  it("uses agent score directly", async () => {
    const { after } = await computeTrust({
      runId: "test-2",
      agentResults: [
        {
          agent: "architecture",
          status: "amber",
          report_path: null,
          severity_max: "high",
          score: 63,
          findings_count: 2,
          findings_by_severity: { critical: 1, high: 1, medium: 0, low: 0, info: 0 },
          duration_ms: 100,
          retries: 0,
          quarantined: false,
          anomaly_score: 0,
        },
      ],
      driftFindings: 0,
      retries: 0,
      quarantinedAgents: 0,
    });
    expect(after.architecture).toBe(63);
  });

  it("orchestration penalty depends on retries + quarantine", async () => {
    const { after } = await computeTrust({
      runId: "test-3",
      agentResults: [],
      driftFindings: 0,
      retries: 2,
      quarantinedAgents: 1,
    });
    expect(after.orchestration).toBeLessThan(80);
  });

  it("release is min of three primary scores", async () => {
    const { after } = await computeTrust({
      runId: "test-4",
      agentResults: [
        {
          agent: "qa",
          status: "amber",
          report_path: null,
          severity_max: "high",
          score: 70,
          findings_count: 1,
          findings_by_severity: { critical: 0, high: 1, medium: 0, low: 0, info: 0 },
          duration_ms: 100,
          retries: 0,
          quarantined: false,
          anomaly_score: 0,
        },
      ],
      driftFindings: 0,
      retries: 0,
      quarantinedAgents: 0,
    });
    expect(after.release).toBe(after.qa);
  });
});

describe("master internals", () => {
  it("decide blocks on critical", () => {
    const stack = { critical: 1, high: 0, medium: 0, low: 0, info: 0 };
    expect(_internal.decide(stack, { release: 95 })).toBe("release_blocked");
  });

  it("decide is needs_review when release trust low", () => {
    const stack = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    expect(_internal.decide(stack, { release: 80 })).toBe("needs_review");
  });

  it("decide is release_candidate when clean", () => {
    const stack = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    expect(_internal.decide(stack, { release: 92 })).toBe("release_candidate");
  });
});
