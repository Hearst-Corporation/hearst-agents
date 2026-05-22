import { describe, expect, it } from "vitest";
import { type MissionLike, missionToFocal } from "@/lib/ui/focal-mappers";

const THREAD_ID = "thread-test-1";

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
