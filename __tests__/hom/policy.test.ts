/**
 * Smoke tests pour le policy engine HOM.
 * Vérifie : whitelist par défaut, exceptions, scopes globs.
 *
 * NB : on importe le module dans un environnement Node (node:fs/promises est OK).
 * Vitest tourne en Node par défaut.
 */
// Forcer __dirname Node, pas server-only.
// On invalide le check `import "server-only"` en mockant le module avant import.
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { evaluate, clearPolicyCache } = await import("@/lib/hom/policy");

describe("policy engine", () => {
  beforeAll(() => {
    clearPolicyCache();
  });

  it("autorise l'écriture append-only sur audits", async () => {
    const r = await evaluate({
      agent_id: "architecture",
      action: "write_file",
      scope: "hom/audits/architecture/some-report.md",
    });
    expect(r.decision).toBe("allow");
    expect(r.rule_id).toBe("P-001");
  });

  it("refuse les actions non listées (default-deny)", async () => {
    const r = await evaluate({
      agent_id: "architecture",
      action: "format_disk",
      scope: "/dev/sda1",
    });
    expect(r.decision).toBe("deny");
    expect(r.rule_id).toBeNull();
  });

  it("refuse l'écriture sur AGENT-LOCK.json", async () => {
    const r = await evaluate({
      agent_id: "design-system",
      action: "write_file",
      scope: "docs/AGENT-LOCK.json",
    });
    expect(r.decision).toBe("deny");
    expect(r.rule_id).toBe("P-002");
  });

  it("require human approval pour ADRs", async () => {
    const r = await evaluate({
      agent_id: "qa",
      action: "write_file",
      scope: "hom/docs/adr/ADR-005-test.md",
    });
    expect(r.decision).toBe("require_human_approval");
  });

  it("autorise spawn_subagent uniquement pour master", async () => {
    const allowed = await evaluate({
      agent_id: "master",
      action: "spawn_subagent",
    });
    expect(allowed.decision).toBe("allow");

    const denied = await evaluate({
      agent_id: "architecture",
      action: "spawn_subagent",
    });
    expect(denied.decision).toBe("deny");
  });

  it("refuse external_network pour tous", async () => {
    const r = await evaluate({
      agent_id: "design-system",
      action: "external_network",
    });
    expect(r.decision).toBe("deny");
  });
});
