/**
 * Tests — hospitality reports specs (3 specs valides Zod + sample data
 * generators consistants).
 */
import { describe, expect, it } from "vitest";
import {
  buildHospitalityDailyBrief,
  buildHospitalityDailyBriefSampleData,
  buildHospitalityGuestSatisfaction,
  buildHospitalityGuestSatisfactionSampleData,
  buildHospitalityRevpar,
  buildHospitalityRevparSampleData,
  CATALOG,
  HOSPITALITY_DAILY_BRIEF_ID,
  HOSPITALITY_GUEST_SATISFACTION_ID,
  HOSPITALITY_REVPAR_ID,
} from "@/lib/reports/catalog";
import { reportSpecSchema } from "@/lib/reports/spec/schema";

const SCOPE = {
  tenantId: "tenant-h",
  workspaceId: "ws-1",
  userId: "user-1",
};

describe("hospitality specs — Zod validation", () => {
  it("Daily Briefing — Hospitality est un Spec valide", () => {
    const spec = buildHospitalityDailyBrief(SCOPE);
    expect(() => reportSpecSchema.parse(spec)).not.toThrow();
    expect(spec.id).toBe(HOSPITALITY_DAILY_BRIEF_ID);
    expect(spec.meta.title).toContain("Daily Briefing");
  });

  it("RevPAR & ADR — Hospitality est un Spec valide", () => {
    const spec = buildHospitalityRevpar(SCOPE);
    expect(() => reportSpecSchema.parse(spec)).not.toThrow();
    expect(spec.id).toBe(HOSPITALITY_REVPAR_ID);
    expect(spec.meta.domain).toBe("finance");
  });

  it("Guest Satisfaction — Hospitality est un Spec valide", () => {
    const spec = buildHospitalityGuestSatisfaction(SCOPE);
    expect(() => reportSpecSchema.parse(spec)).not.toThrow();
    expect(spec.id).toBe(HOSPITALITY_GUEST_SATISFACTION_ID);
    expect(spec.meta.domain).toBe("support");
  });

  it("les 3 specs sont enregistrés dans le CATALOG global", () => {
    const ids = CATALOG.map((c) => c.id);
    expect(ids).toContain(HOSPITALITY_DAILY_BRIEF_ID);
    expect(ids).toContain(HOSPITALITY_REVPAR_ID);
    expect(ids).toContain(HOSPITALITY_GUEST_SATISFACTION_ID);
  });

  it("requiredApps contient 'pms' pour les 3 specs hospitality", () => {
    const hospEntries = CATALOG.filter((c) =>
      [
        HOSPITALITY_DAILY_BRIEF_ID,
        HOSPITALITY_REVPAR_ID,
        HOSPITALITY_GUEST_SATISFACTION_ID,
      ].includes(c.id),
    );
    expect(hospEntries).toHaveLength(3);
    for (const e of hospEntries) {
      expect(e.requiredApps).toContain("pms");
    }
  });
});

describe("hospitality specs — sample data generators", () => {
  it("daily brief sample data couvre tous les dataRefs du spec", () => {
    const spec = buildHospitalityDailyBrief(SCOPE);
    const sample = buildHospitalityDailyBriefSampleData();
    const requiredRefs = new Set(spec.blocks.map((b) => b.dataRef));
    for (const ref of requiredRefs) {
      expect(sample).toHaveProperty(ref);
    }
  });

  it("revpar sample data retourne la shape attendue (PMS non configuré → tableaux vides)", () => {
    const sample = buildHospitalityRevparSampleData();
    // Shape présente, valeurs vides : PMS non configuré
    expect(sample).toHaveProperty("pms_revpar_30d");
    expect(sample).toHaveProperty("pms_revenue_source");
    expect(sample.pms_revpar_30d).toEqual([]);
    expect(sample.pms_revenue_source).toEqual([]);
  });

  it("guest satisfaction sample data retourne la shape attendue (PMS non configuré → tableau vide)", () => {
    const sample = buildHospitalityGuestSatisfactionSampleData();
    // Shape présente, valeur vide : PMS non configuré
    expect(sample).toHaveProperty("guest_satisfaction");
    expect(sample.guest_satisfaction).toHaveLength(0);
  });
});
