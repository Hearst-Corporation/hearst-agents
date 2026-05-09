/**
 * Smoke test orchestrator end-to-end.
 * Lance un vrai run sur le repo, vérifie l'output decision.json + snapshot.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { startRun } = await import("@/lib/hom/master");
const { readJson, fileExists } = await import("@/lib/hom/fs-utils");
const { HOM } = await import("@/lib/hom/paths");

describe("orchestrator end-to-end", () => {
  it("runs the 3 agents and produces a decision", { timeout: 60_000 }, async () => {
    const result = await startRun({
      triggeredBy: "vitest",
      triggerKind: "manual",
    });

    expect(result.runId).toMatch(/^r-[0-9a-f]{8}$/);
    expect(["release_candidate", "needs_review", "release_blocked"]).toContain(result.decision);

    const decisionExists = await fileExists(HOM.runDecision(result.runId));
    expect(decisionExists).toBe(true);

    const decision = await readJson<{ agents: { agent: string }[] }>(HOM.runDecision(result.runId));
    expect(decision).toBeTruthy();
    expect(decision?.agents.map((a) => a.agent).sort()).toEqual([
      "architecture",
      "design-system",
      "qa",
    ]);

    const snapshotExists = await fileExists(HOM.runSnapshot(result.runId));
    expect(snapshotExists).toBe(true);
  });
});
