import { describe, expect, it } from "vitest";
import { activeItem, NAV_SECTIONS } from "../app/admin/_shell/nav";

describe("activeItem (admin nav)", () => {
  it("accueil exact /admin bat les préfixes plus longs", () => {
    expect(activeItem("/admin")?.href).toBe("/admin");
  });

  it("agents sur /admin/agents", () => {
    expect(activeItem("/admin/agents")?.href).toBe("/admin/agents");
  });

  it("agents détail bat /admin", () => {
    expect(activeItem("/admin/agents/xyz")?.href).toBe("/admin/agents");
  });

  it("settings bat agents et accueil", () => {
    expect(activeItem("/admin/settings")?.href).toBe("/admin/settings");
  });

  it("NAV contient Accueil, Pipeline, Agents, Runs dans la section Pipeline", () => {
    const pipeline = NAV_SECTIONS.find((s) => s.title === "Pipeline")?.items ?? [];
    expect(pipeline[0]?.label).toBe("Accueil");
    expect(pipeline[0]?.href).toBe("/admin");
    expect(pipeline[1]?.label).toBe("Pipeline");
    expect(pipeline[1]?.href).toBe("/admin/pipeline");
    expect(pipeline[2]?.label).toBe("Agents");
    expect(pipeline[2]?.href).toBe("/admin/agents");
    expect(pipeline[3]?.label).toBe("Runs");
    expect(pipeline[3]?.href).toBe("/admin/runs");
  });
});
