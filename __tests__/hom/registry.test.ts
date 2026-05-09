/**
 * Smoke test pour le registry collector.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { buildRegistry } = await import("@/lib/hom/registry");

describe("registry", () => {
  it("collects pages, components, api routes, tests", { timeout: 30_000 }, async () => {
    const reg = await buildRegistry();
    expect(reg.totals.pages).toBeGreaterThan(0);
    expect(reg.totals.api_routes).toBeGreaterThan(0);
    expect(reg.entries.length).toBeGreaterThan(0);
    expect(reg.agents.length).toBe(3);
    expect(reg.agents.map((a) => a.agent_id).sort()).toEqual([
      "architecture",
      "design-system",
      "qa",
    ]);
  });
});
