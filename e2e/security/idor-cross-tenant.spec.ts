/**
 * E2E — IDOR cross-tenant.
 *
 * Vérifie qu'une session authentifiée du tenant A ne peut PAS lire/modifier
 * des ressources du tenant B. Toutes les routes doivent retourner 404 (pas
 * 403) pour éviter la fuite d'existence cross-tenant.
 *
 * Pré-requis runtime (sinon test.skip):
 *  - HEARST_E2E_IDOR_RUN=1
 *  - HEARST_E2E_TENANT_A_TOKEN (NextAuth JWT or API key tenant A)
 *  - HEARST_E2E_TENANT_B_RUN_ID (UUID d'un run existant tenant B)
 *  - HEARST_E2E_TENANT_B_AGENT_ID
 *  - HEARST_E2E_TENANT_B_MISSION_ID
 *  - HEARST_E2E_TENANT_B_REPORT_ID
 *
 * Skip-CI : ce test demande deux tenants pré-provisionnés. Run manuel.
 */

import { expect, test } from "@playwright/test";

const TENANT_A_TOKEN = process.env.HEARST_E2E_TENANT_A_TOKEN ?? "";
const RESOURCES = {
  runId: process.env.HEARST_E2E_TENANT_B_RUN_ID ?? "",
  agentId: process.env.HEARST_E2E_TENANT_B_AGENT_ID ?? "",
  missionId: process.env.HEARST_E2E_TENANT_B_MISSION_ID ?? "",
  reportId: process.env.HEARST_E2E_TENANT_B_REPORT_ID ?? "",
};

test.describe("@skip-ci IDOR cross-tenant — tenant A ne lit pas tenant B", () => {
  test.skip(
    process.env.HEARST_E2E_IDOR_RUN !== "1",
    "Set HEARST_E2E_IDOR_RUN=1 et provisionne les 4 ressources tenant B pour run",
  );
  test.skip(!TENANT_A_TOKEN, "HEARST_E2E_TENANT_A_TOKEN manquant");

  const authHeaders = { Authorization: `Bearer ${TENANT_A_TOKEN}` };

  test("GET /api/v1/runs/[id] (run tenant B) → 404", async ({ request }) => {
    test.skip(!RESOURCES.runId, "HEARST_E2E_TENANT_B_RUN_ID manquant");
    const res = await request.get(`/api/v1/runs/${RESOURCES.runId}`, { headers: authHeaders });
    expect(res.status(), "doit retourner 404 sans révéler l'existence").toBe(404);
    const body = await res.json().catch(() => ({}));
    expect(body.error).toBe("run_not_found");
  });

  test("GET /api/agents/[id] (agent tenant B) → 404", async ({ request }) => {
    test.skip(!RESOURCES.agentId, "HEARST_E2E_TENANT_B_AGENT_ID manquant");
    const res = await request.get(`/api/agents/${RESOURCES.agentId}`, { headers: authHeaders });
    expect(res.status()).toBe(404);
  });

  test("GET /api/v2/missions/[id] (mission tenant B) → 404", async ({ request }) => {
    test.skip(!RESOURCES.missionId, "HEARST_E2E_TENANT_B_MISSION_ID manquant");
    const res = await request.get(`/api/v2/missions/${RESOURCES.missionId}`, {
      headers: authHeaders,
    });
    expect(res.status()).toBe(404);
  });

  test("GET /api/reports/[reportId]/comments (report tenant B) → 404", async ({ request }) => {
    test.skip(!RESOURCES.reportId, "HEARST_E2E_TENANT_B_REPORT_ID manquant");
    const res = await request.get(`/api/reports/${RESOURCES.reportId}/comments`, {
      headers: authHeaders,
    });
    // La route retourne systématiquement 404 (jamais 403) pour les cas asset
    // absent, mauvais kind, et provenance.userId mismatch — évite la fuite
    // d'existence cross-tenant (le 403 révèle que l'asset existe).
    expect(res.status(), "doit retourner 404 sans révéler l'existence").toBe(404);
  });
});
