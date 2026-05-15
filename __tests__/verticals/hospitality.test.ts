/**
 * Tests — hospitality vertical (industry detection + vocabulary).
 * Le payload Cockpit n'expose plus de section hospitality (pivot v1.6).
 */
import { beforeEach, describe, expect, it } from "vitest";

import {
  __resetHospitalityCache,
  getTenantIndustry,
  HOSPITALITY_KPIS,
  HOSPITALITY_VOCABULARY,
  isHospitalityTenant,
  setTenantIndustry,
} from "@/lib/verticals/hospitality";

describe("hospitality — industry detection", () => {
  beforeEach(() => {
    __resetHospitalityCache();
  });

  it("default industry est 'general' quand non défini", async () => {
    const industry = await getTenantIndustry("tenant-fresh");
    expect(industry).toBe("general");
  });

  it("setTenantIndustry persiste en mémoire et est lu ensuite", async () => {
    await setTenantIndustry("tenant-h1", "hospitality");
    const out = await getTenantIndustry("tenant-h1");
    expect(out).toBe("hospitality");
  });

  it("isHospitalityTenant retourne true uniquement si industry === 'hospitality'", async () => {
    await setTenantIndustry("tenant-h2", "hospitality");
    expect(await isHospitalityTenant("tenant-h2")).toBe(true);
    await setTenantIndustry("tenant-saas", "saas");
    expect(await isHospitalityTenant("tenant-saas")).toBe(false);
  });

  it("normalise les industry inconnues vers 'general'", async () => {
    await setTenantIndustry("tenant-x", "industry-inexistante" as never);
    const out = await getTenantIndustry("tenant-x");
    expect(out).toBe("general");
  });

  it("vocabulary expose preferred + avoid", () => {
    expect(HOSPITALITY_VOCABULARY.preferred).toContain("guest");
    expect(HOSPITALITY_VOCABULARY.preferred).toContain("RevPAR");
    expect(HOSPITALITY_VOCABULARY.avoid).toContain("MRR");
  });

  it("KPIs constants reste stable", () => {
    expect(HOSPITALITY_KPIS).toContain("occupancy");
    expect(HOSPITALITY_KPIS).toContain("revpar");
    expect(HOSPITALITY_KPIS).toContain("guest_satisfaction_nps");
  });
});
