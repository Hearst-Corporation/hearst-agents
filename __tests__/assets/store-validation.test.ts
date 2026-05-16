/**
 * Asset persistence — server-side title validation.
 *
 * Both write paths (`lib/assets/types.ts:storeAsset` and
 * `lib/engine/runtime/assets/adapter.ts:saveAsset`) refuse to persist
 * assets with empty / "Untitled" titles. Verifies the guard at the source
 * eliminates the ghost rows that were polluting the right panel.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks pour les deux paths d'écriture ──────────────────────
// Depuis DUP8, `storeAsset` (orchestrator) ET `saveAsset` (adapter v2) passent
// tous deux par `getServerSupabase()`. On route via le `kind` mappé dans le
// payload upsert pour conserver deux compteurs distincts :
//   - orchestrator path → kind direct ("report", "brief", etc.) → upsertMock
//   - adapter path      → kind mappé via mapTypeToKind ("document",
//                         "spreadsheet", "report", "message") → adapterUpsertMock
// Le mapping `mapTypeToKind` produit "document" pour type "doc"/"pdf"/"json"
// (les seuls utilisés dans les tests), donc on discrimine sur ce kind.
const upsertMock = vi.fn().mockResolvedValue({ error: null });
const adapterUpsertMock = vi.fn().mockResolvedValue({ error: null });

const ADAPTER_KINDS = new Set(["document", "spreadsheet", "message"]);

function routedUpsert(payload: { kind?: string } & Record<string, unknown>) {
  if (payload?.kind && ADAPTER_KINDS.has(payload.kind)) {
    return adapterUpsertMock(payload);
  }
  return upsertMock(payload);
}

vi.mock("@/lib/platform/db/supabase", () => ({
  getServerSupabase: () => ({
    from: () => ({ upsert: routedUpsert }),
  }),
}));

// Legacy mock conservé : un éventuel import direct de `@supabase/supabase-js`
// (storage provider, healthcheck, hospitality singleton) ne doit pas casser
// le module-graph chargé par ce test.
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: () => ({ upsert: vi.fn().mockResolvedValue({ error: null }) }),
  })),
}));

import type { Asset as OrchestratorAsset } from "@/lib/assets/types";
// ── Imports after mocks ───────────────────────────────────────
import { storeAsset } from "@/lib/assets/types";
import { saveAsset } from "@/lib/engine/runtime/assets/adapter";
import type { Asset as RuntimeAsset } from "@/lib/engine/runtime/assets/types";

beforeEach(() => {
  upsertMock.mockReset().mockResolvedValue({ error: null });
  adapterUpsertMock.mockReset().mockResolvedValue({ error: null });
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
});

function orchestratorAsset(title: string): OrchestratorAsset {
  return {
    id: "asset-1",
    threadId: "thread-1",
    kind: "report",
    title,
    summary: "",
    outputTier: "report",
    provenance: { providerId: "google", sentAt: 0 },
    createdAt: 1700000000000,
    contentRef: "",
    runId: "run-1",
  };
}

function runtimeAsset(name: string): RuntimeAsset {
  return {
    id: "asset-1",
    type: "doc",
    name,
    run_id: "run-1",
    tenantId: "t",
    workspaceId: "w",
    created_at: 1700000000000,
    metadata: {},
  };
}

describe("storeAsset — orchestrator path", () => {
  it("persists when title is a real string", () => {
    storeAsset(orchestratorAsset("Synthèse mensuelle"));
    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(upsertMock.mock.calls[0][0]).toMatchObject({
      title: "Synthèse mensuelle",
    });
  });

  it("rejects empty title", () => {
    storeAsset(orchestratorAsset(""));
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("rejects whitespace-only title", () => {
    storeAsset(orchestratorAsset("   "));
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("rejects 'Untitled' (exact match)", () => {
    storeAsset(orchestratorAsset("Untitled"));
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("rejects 'untitled' (lowercase)", () => {
    storeAsset(orchestratorAsset("untitled"));
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("rejects ' Untitled ' (padded)", () => {
    storeAsset(orchestratorAsset(" Untitled "));
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("trims valid titles before persisting", () => {
    storeAsset(orchestratorAsset("  Hello world  "));
    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(upsertMock.mock.calls[0][0].title).toBe("Hello world");
  });

  it("accepts 'Untitled report' (Untitled is a prefix, not the whole title)", () => {
    storeAsset(orchestratorAsset("Untitled report v2"));
    expect(upsertMock).toHaveBeenCalledTimes(1);
  });
});

describe("saveAsset — API path (adapter)", () => {
  it("persists when name is set", async () => {
    const ok = await saveAsset(runtimeAsset("Quarterly KPIs"));
    expect(ok).toBe(true);
    expect(adapterUpsertMock).toHaveBeenCalledTimes(1);
  });

  it("rejects empty name", async () => {
    const ok = await saveAsset(runtimeAsset(""));
    expect(ok).toBe(false);
    expect(adapterUpsertMock).not.toHaveBeenCalled();
  });

  it("rejects whitespace-only name", async () => {
    const ok = await saveAsset(runtimeAsset("\t\t"));
    expect(ok).toBe(false);
    expect(adapterUpsertMock).not.toHaveBeenCalled();
  });

  it("rejects 'Untitled'", async () => {
    const ok = await saveAsset(runtimeAsset("Untitled"));
    expect(ok).toBe(false);
    expect(adapterUpsertMock).not.toHaveBeenCalled();
  });

  it("uses the trimmed name in the persisted row", async () => {
    await saveAsset(runtimeAsset("  Hello  "));
    expect(adapterUpsertMock).toHaveBeenCalledTimes(1);
    expect(adapterUpsertMock.mock.calls[0][0].title).toBe("Hello");
  });
});
