/**
 * B1.2 — Conversation IDOR (F-003)
 *
 * Vérifie que getRecentModelMessages() exige un scope complet et isole deux
 * users qui réutilisent le même conversation_id fourni côté client.
 */

import type { ModelMessage } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

const SCOPE_A = { userId: "user-a-uuid", tenantId: "tenant-a-uuid", workspaceId: "ws-a" };
const SCOPE_B = { userId: "user-b-uuid", tenantId: "tenant-b-uuid", workspaceId: "ws-b" };

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => null),
}));

async function freshStore() {
  vi.resetModules();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "";
  return await import("@/lib/memory/store");
}

describe("F-003 Conversation IDOR — filtre user_id dans getRecentMessages", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("getRecentModelMessages isole deux users avec le même conversation_id", async () => {
    const { appendModelMessages, getRecentModelMessages } = await freshStore();
    const msgA: ModelMessage = { role: "user", content: "secret user A" };
    const msgB: ModelMessage = { role: "user", content: "secret user B" };

    appendModelMessages("shared-conv", [msgA], SCOPE_A);
    appendModelMessages("shared-conv", [msgB], SCOPE_B);

    const outA = await getRecentModelMessages("shared-conv", 20, SCOPE_A);
    const outB = await getRecentModelMessages("shared-conv", 20, SCOPE_B);

    expect(outA).toEqual([msgA]);
    expect(outB).toEqual([msgB]);
    expect(outA).not.toEqual(outB);
  });
});
