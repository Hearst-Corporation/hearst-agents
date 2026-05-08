/**
 * Feature 1 — NOTIFICATIONS : invariants throttle + dispatcher.
 *
 * Tests P2 :
 *  1. Throttle : 1er dispatch OK, même signal < 4h → throttled
 *  2. Best-effort canaux : canal qui throw → anyDelivered = true si l'autre OK
 *  3. Severity floor : signal "info" avec severityFloor "critical" → filtré
 *  4. user_id null broadcast : listNotifications sans userId ne filtre pas par user_id
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { shouldThrottle, THROTTLE_WINDOW_MS } from "@/lib/notifications/throttle";
import { dispatchAlerts } from "@/lib/notifications/alert-dispatcher";
import { listNotifications, createNotification } from "@/lib/notifications/in-app";
import type { ThrottleStore } from "@/lib/notifications/throttle";
import type { AlertingPreferences } from "@/lib/notifications/schema";
import type { BusinessSignal } from "@/lib/reports/signals/extract";

// ── Helpers ──────────────────────────────────────────────────

function makeStore(): ThrottleStore {
  const map = new Map<string, number>();
  return {
    getLast: (k) => map.get(k) ?? null,
    markEmitted: (k, t) => { map.set(k, t); },
  };
}

function makeSignal(severity: BusinessSignal["severity"], type: BusinessSignal["type"] = "mrr_drop"): BusinessSignal {
  return { type, severity, message: "test message", blockId: "b1" };
}

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const REPORT = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", title: "Test" };

// Silence console.log/warn pendant les tests
let logSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
  warnSpy.mockRestore();
});

// ── Test 1 : Throttle 4h ─────────────────────────────────────

describe("shouldThrottle", () => {
  it("premier dispatch non throttlé, même signal < 4h throttlé", () => {
    const store = makeStore();
    const now = Date.now();

    // Premier dispatch → pas throttlé
    expect(shouldThrottle(store, "T1", "mrr_drop", now)).toBe(false);

    // Marque comme émis
    store.markEmitted("T1:mrr_drop", now);

    // Même signal 1h plus tard → throttlé (1h < 4h)
    const oneHourLater = now + 60 * 60 * 1000;
    expect(shouldThrottle(store, "T1", "mrr_drop", oneHourLater)).toBe(true);
  });

  it("même signal après la fenêtre de throttle → plus throttlé", () => {
    const store = makeStore();
    const now = Date.now();
    store.markEmitted("T1:mrr_drop", now);

    // 4h + 1ms après → plus throttlé
    const afterWindow = now + THROTTLE_WINDOW_MS + 1;
    expect(shouldThrottle(store, "T1", "mrr_drop", afterWindow)).toBe(false);
  });
});

// ── Test 2 : Best-effort canaux ──────────────────────────────

describe("dispatchAlerts — best-effort canaux", () => {
  it("canal qui throw n'invalide pas l'autre — anyDelivered = true si l'autre réussit", async () => {
    let callCount = 0;
    const fetcher = async () => {
      callCount++;
      // Premier canal (webhook[0]) throw, deuxième réussit
      if (callCount === 1) throw new Error("canal down");
      return new Response(null, { status: 200 });
    };

    const preferences: AlertingPreferences = {
      webhooks: [
        { url: "https://fail.example.com", signalTypes: "*", enabled: true },
        { url: "https://ok.example.com", signalTypes: "*", enabled: true },
      ],
    };

    const result = await dispatchAlerts({
      tenantId: TENANT,
      signals: [makeSignal("critical")],
      report: REPORT,
      preferences,
      throttleStore: makeStore(),
      now: Date.now(),
      fetcher: fetcher as typeof fetch,
    });

    // Un canal a échoué, l'autre a réussi → anyDelivered = true
    expect(result.anyDelivered).toBe(true);
    expect(result.dispatchedSignals).toHaveLength(1);
  });
});

// ── Test 3 : Severity floor ──────────────────────────────────

describe("dispatchAlerts — severityFloor", () => {
  it("signal 'info' avec severityFloor 'critical' → filtré, pas dispatché", async () => {
    const result = await dispatchAlerts({
      tenantId: TENANT,
      signals: [makeSignal("info")],
      report: REPORT,
      preferences: { webhooks: [] },
      throttleStore: makeStore(),
      severityFloor: "critical",
      now: Date.now(),
    });

    expect(result.dispatchedSignals).toHaveLength(0);
    expect(result.throttledSignals).toHaveLength(0);
    expect(result.anyDelivered).toBe(false);
  });

  it("signal 'warning' avec severityFloor 'warning' → dispatché", async () => {
    const fetcher = async () => new Response(null, { status: 200 });
    const result = await dispatchAlerts({
      tenantId: TENANT,
      signals: [makeSignal("warning")],
      report: REPORT,
      preferences: {
        webhooks: [{ url: "https://ok.example.com", signalTypes: "*", enabled: true }],
      },
      throttleStore: makeStore(),
      severityFloor: "warning",
      now: Date.now(),
      fetcher: fetcher as typeof fetch,
    });

    expect(result.dispatchedSignals).toHaveLength(1);
  });
});

// ── Test 4 : user_id null broadcast ─────────────────────────

describe("listNotifications — user_id null broadcast", () => {
  it("sans userId, la query ne filtre pas par user_id (accessible à tous)", async () => {
    // On inspecte les appels Supabase via un mock structurel
    const capturedQuery: Record<string, unknown>[] = [];

    const mockDb = {
      from: () => ({
        select: () => ({
          eq: (col: string, val: unknown) => {
            capturedQuery.push({ col, val });
            return {
              eq: () => ({
                order: () => ({
                  limit: () => ({
                    is: () => Promise.resolve({ data: [], error: null }),
                    then: (res: (v: { data: unknown[]; error: null }) => unknown) =>
                      res({ data: [], error: null }),
                  }),
                  then: (res: (v: { data: unknown[]; error: null }) => unknown) =>
                    res({ data: [], error: null }),
                }),
                limit: () => ({
                  is: () => Promise.resolve({ data: [], error: null }),
                  then: (res: (v: { data: unknown[]; error: null }) => unknown) =>
                    res({ data: [], error: null }),
                }),
              }),
              order: () => ({
                limit: () => ({
                  is: () => Promise.resolve({ data: [], error: null }),
                  then: (res: (v: { data: unknown[]; error: null }) => unknown) =>
                    res({ data: [], error: null }),
                }),
                then: (res: (v: { data: unknown[]; error: null }) => unknown) =>
                  res({ data: [], error: null }),
              }),
            };
          },
          order: () => ({
            limit: () => ({
              then: (res: (v: { data: unknown[]; error: null }) => unknown) =>
                res({ data: [], error: null }),
            }),
          }),
        }),
      }),
    };

    // On appelle listNotifications SANS userId pour vérifier le broadcast
    await listNotifications(mockDb as never, {
      tenantId: TENANT,
      // Pas de userId → pas de filtre user_id
    });

    // Aucun filtre user_id ne doit être présent dans les appels eq
    const userIdFilter = capturedQuery.find((q) => q.col === "user_id");
    expect(userIdFilter).toBeUndefined();
  });

  it("createNotification sans userId insère user_id: null", async () => {
    const insertedRows: Record<string, unknown>[] = [];

    const mockDb = {
      from: () => ({
        insert: (row: Record<string, unknown>) => {
          insertedRows.push(row);
          return {
            select: () => ({
              single: () =>
                Promise.resolve({
                  data: {
                    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
                    tenant_id: TENANT,
                    user_id: null,
                    kind: "signal",
                    severity: "critical",
                    title: "Test broadcast",
                    body: null,
                    meta: null,
                    read_at: null,
                    created_at: new Date().toISOString(),
                  },
                  error: null,
                }),
            }),
          };
        },
      }),
    };

    await createNotification(mockDb as never, {
      tenantId: TENANT,
      // Pas de userId → broadcast
      kind: "signal",
      severity: "critical",
      title: "Test broadcast",
    });

    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0]?.user_id).toBeNull();
  });
});
