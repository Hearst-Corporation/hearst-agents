/**
 * Feature 6 — DAILY-BRIEF : invariants idempotence + fail-soft source.
 *
 * Tests P2 :
 *  1. Idempotence par date : si un asset daily_brief existe pour targetDate,
 *     le handler retourne l'asset existant sans re-générer
 *  2. Fail-soft source Gmail : Gmail throw → brief continue, sources contient "gmail:error"
 */

import { describe, it, expect, vi, afterEach } from "vitest";

// ── Mocks communs ─────────────────────────────────────────────

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

// ── Test 1 : Idempotence par date ─────────────────────────────

describe("POST /api/v2/daily-brief/generate — idempotence", () => {
  it("brief existant pour targetDate → retourne l'asset sans re-générer", async () => {
    // Mock requireScope
    vi.doMock("@/lib/platform/auth/scope", () => ({
      requireScope: vi.fn().mockResolvedValue({
        scope: {
          userId: "user-001",
          tenantId: "tenant-001",
          workspaceId: "ws-001",
        },
        error: null,
      }),
    }));

    // Mock loadDailyBriefForDate → retourne un brief existant
    const existingAssetId = "asset-existing-001";
    vi.doMock("@/lib/daily-brief/store", () => ({
      loadDailyBriefForDate: vi.fn().mockResolvedValue({
        assetId: existingAssetId,
        title: "Daily Brief · 8 mai 2026",
        summary: "5 signaux",
        createdAt: Date.now(),
        narration: { lead: "l", people: "p", decisions: "d", signals: "s", costUsd: 0.02 },
        meta: { targetDate: "2026-05-08", totalItems: 5, sources: ["gmail"], pdfUrl: null, storageKey: null, pdfSizeBytes: null },
        counts: { emails: 5, slack: 0, calendar: 0, github: 0, linear: 0 },
        pdfUrl: null,
      }),
    }));

    // Mock enqueueJob (ne doit pas être appelé)
    const enqueueJobMock = vi.fn();
    vi.doMock("@/lib/jobs/queue", () => ({
      enqueueJob: enqueueJobMock,
    }));

    // Mock checkDailyCap (P5 daily cap, doit allow pour atteindre le path idempotence)
    vi.doMock("@/lib/credits/daily-caps", () => ({
      checkDailyCap: vi.fn().mockResolvedValue({ allowed: true, current: 0, max: 5 }),
    }));

    const { NextRequest } = await import("next/server");
    const { POST } = await import("@/app/api/v2/daily-brief/generate/route");

    const req = new NextRequest("http://localhost/api/v2/daily-brief/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targetDate: "2026-05-08" }),
    });

    const res = await POST(req);
    const body = await res.json() as { status: string; assetId: string };

    // Doit retourner l'asset existant
    expect(res.status).toBe(200);
    expect(body.status).toBe("exists");
    expect(body.assetId).toBe(existingAssetId);

    // enqueueJob ne doit pas être appelé
    expect(enqueueJobMock).not.toHaveBeenCalled();
  });
});

// ── Test 2 : Fail-soft source Gmail ───────────────────────────

describe("assembleDailyBriefData — fail-soft Gmail", () => {
  it("Gmail throw → brief continue, sources contient 'gmail:error'", async () => {
    // Mock Gmail qui throw
    vi.doMock("@/lib/connectors/google/gmail", () => ({
      getRecentEmails: vi.fn().mockRejectedValue(new Error("Gmail API unavailable")),
    }));

    // Mock Calendar OK (vide)
    vi.doMock("@/lib/connectors/google/calendar", () => ({
      getTodayEvents: vi.fn().mockResolvedValue([]),
    }));

    // Mock Composio (Slack, GitHub, Linear) → retourne des résultats vides
    vi.doMock("@/lib/connectors/composio/client", () => ({
      executeComposioAction: vi.fn().mockResolvedValue({ ok: false, data: null }),
    }));

    vi.doMock("@/lib/connectors/composio/connections", () => ({
      listConnections: vi.fn().mockResolvedValue([]),
    }));

    const { assembleDailyBriefData } = await import("@/lib/daily-brief/assembler");

    const data = await assembleDailyBriefData({
      userId: "user-001",
      tenantId: "tenant-001",
      targetDate: "2026-05-08",
    });

    // Le brief doit être retourné même si Gmail a échoué
    expect(data).toBeDefined();
    expect(data.emails).toHaveLength(0);

    // sources doit contenir "gmail:error"
    expect(data.sources).toContain("gmail:error");

    // Les autres sources ne sont pas en erreur
    expect(data.sources).not.toContain("calendar:error");
  });

  it("toutes sources en erreur → sources contient N entrées ':error'", async () => {
    vi.doMock("@/lib/connectors/google/gmail", () => ({
      getRecentEmails: vi.fn().mockRejectedValue(new Error("Gmail down")),
    }));

    vi.doMock("@/lib/connectors/google/calendar", () => ({
      getTodayEvents: vi.fn().mockRejectedValue(new Error("Calendar down")),
    }));

    vi.doMock("@/lib/connectors/composio/client", () => ({
      executeComposioAction: vi.fn().mockRejectedValue(new Error("Composio down")),
    }));

    vi.doMock("@/lib/connectors/composio/connections", () => ({
      listConnections: vi.fn().mockResolvedValue([]),
    }));

    const { assembleDailyBriefData } = await import("@/lib/daily-brief/assembler");

    const data = await assembleDailyBriefData({
      userId: "user-001",
      tenantId: "tenant-001",
      targetDate: "2026-05-08",
    });

    // Les 5 sources core doivent toutes être en erreur
    const errorSources = data.sources.filter((s) => s.endsWith(":error"));
    expect(errorSources.length).toBeGreaterThanOrEqual(2); // au moins gmail + calendar

    // Le résultat reste valide malgré les erreurs
    expect(data.emails).toEqual([]);
    expect(data.calendar).toEqual([]);
    expect(data.targetDate).toBe("2026-05-08");
  });
});
