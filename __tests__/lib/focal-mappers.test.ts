import { describe, expect, it } from "vitest";
import { mapFocalObject } from "@/lib/core/types/focal";
import { type MissionLike, missionToFocal } from "@/lib/ui/focal-mappers";

const THREAD_ID = "thread-test-1";

// ── mapFocalObject ────────────────────────────────────────────────────

describe("mapFocalObject", () => {
  it("type invalide → forcé à 'brief' (fallback)", () => {
    const result = mapFocalObject({ objectType: "not_a_real_type", title: "T" }, THREAD_ID);
    expect(result?.type).toBe("brief");
  });

  it("status invalide → forcé à 'ready' (fallback)", () => {
    const result = mapFocalObject(
      { objectType: "report", title: "T", status: "unknown_status" },
      THREAD_ID,
    );
    expect(result?.status).toBe("ready");
  });

  it("body absent mais summary présent → body devient le summary", () => {
    const result = mapFocalObject(
      { objectType: "brief", title: "T", summary: "Résumé complet." },
      THREAD_ID,
    );
    // mapFocalObject uses: body = o.body || o.summary || ""
    expect(result?.body).toBe("Résumé complet.");
  });

  it("id absent → id généré au format 'focal-{ts}'", () => {
    const before = Date.now();
    const result = mapFocalObject({ objectType: "brief", title: "T" }, THREAD_ID);
    const after = Date.now();

    expect(result?.id).toMatch(/^focal-\d+$/);
    expect(result?.id).toBeDefined();
    const ts = parseInt(result!.id.replace("focal-", ""), 10);
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it("type valide 'report' → préservé tel quel", () => {
    const result = mapFocalObject({ objectType: "report", title: "Mon rapport" }, THREAD_ID);
    expect(result?.type).toBe("report");
  });

  it("status valide 'delivered' → préservé tel quel", () => {
    const result = mapFocalObject(
      { objectType: "brief", title: "T", status: "delivered" },
      THREAD_ID,
    );
    expect(result?.status).toBe("delivered");
  });

  it("retourne null si l'objet est null", () => {
    expect(mapFocalObject(null, THREAD_ID)).toBeNull();
  });

  it("retourne null si objectType/type absent", () => {
    expect(mapFocalObject({ title: "T" }, THREAD_ID)).toBeNull();
  });
});

// ── missionToFocal ────────────────────────────────────────────────────

describe("missionToFocal", () => {
  const baseMission: MissionLike = {
    id: "mission-abc",
    name: "Veille concurrentielle",
    enabled: true,
    schedule: "daily 9am",
  };

  it("enabled: true → type 'mission_active'", () => {
    const focal = missionToFocal({ ...baseMission, enabled: true }, THREAD_ID);
    expect(focal.type).toBe("mission_active");
  });

  it("enabled: false → type 'mission_draft'", () => {
    const focal = missionToFocal({ ...baseMission, enabled: false }, THREAD_ID);
    expect(focal.type).toBe("mission_draft");
  });

  it("enabled: true → primaryAction.kind = 'pause'", () => {
    const focal = missionToFocal({ ...baseMission, enabled: true }, THREAD_ID);
    expect(focal.primaryAction?.kind).toBe("pause");
  });

  it("enabled: false → primaryAction.kind = 'resume'", () => {
    const focal = missionToFocal({ ...baseMission, enabled: false }, THREAD_ID);
    expect(focal.primaryAction?.kind).toBe("resume");
  });

  it("missionId = id de la mission", () => {
    const focal = missionToFocal(baseMission, THREAD_ID);
    expect(focal.missionId).toBe("mission-abc");
  });

  it("title = name de la mission", () => {
    const focal = missionToFocal(baseMission, THREAD_ID);
    expect(focal.title).toBe("Veille concurrentielle");
  });
});
