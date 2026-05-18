/**
 * Tests unitaires — lib/llm/cockpitChatPersistence.ts
 *
 * Vérifie :
 *  1. Fallback null si les variables d'env Supabase sont absentes.
 *  2. Retourne un objet ChatPersistence avec les méthodes attendues si configuré.
 *  3. Les méthodes (createChat, loadMessages, saveMessage) délèguent à Supabase.
 *
 * Stratégie : vi.mock de @supabase/supabase-js — aucun réseau.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock Supabase avant l'import du module ───────────────────────────────────

const mockSingle = vi.fn();
const mockSelect = vi.fn(() => ({ single: mockSingle }));
const mockInsertChats = vi.fn(() => ({ select: mockSelect }));

// Pour cockpit_messages insert (pas de .select())
const mockInsertMessages = vi.fn(() => ({ error: null as unknown }));

// Pour cockpit_chats update
const mockEqUserId = vi.fn(() => Promise.resolve({ error: null }));
const mockEqChatId = vi.fn(() => ({ eq: mockEqUserId }));
const mockUpdate = vi.fn(() => ({ eq: mockEqChatId }));

// Pour loadMessages
const mockOrder = vi.fn(() => Promise.resolve({ data: [] as unknown[], error: null }));
const mockEqUserIdLoad = vi.fn(() => ({ order: mockOrder }));
const mockEqChatIdLoad = vi.fn(() => ({ eq: mockEqUserIdLoad }));
const mockSelectLoad = vi.fn(() => ({ eq: mockEqChatIdLoad }));

const mockFrom = vi.fn((table: string) => {
  if (table === "cockpit_chats") {
    return { insert: mockInsertChats, update: mockUpdate };
  }
  if (table === "cockpit_messages") {
    return { insert: mockInsertMessages, select: mockSelectLoad };
  }
  return {};
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}));

import { createCockpitChatPersistence } from "../../lib/llm/cockpitChatPersistence";

// ── Setup env ────────────────────────────────────────────────────────────────

const SUPABASE_URL = "https://test.supabase.co";
const SUPABASE_KEY = "service-role-key-test";

beforeEach(() => {
  vi.resetAllMocks();
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Ré-initialise les chaînes de mock
  mockSingle.mockResolvedValue({ data: { id: "chat-uuid-1" }, error: null });
  mockSelect.mockReturnValue({ single: mockSingle });
  mockInsertChats.mockReturnValue({ select: mockSelect });
  mockInsertMessages.mockResolvedValue({ error: null });
  mockEqUserId.mockResolvedValue({ error: null });
  mockEqChatId.mockReturnValue({ eq: mockEqUserId });
  mockUpdate.mockReturnValue({ eq: mockEqChatId });
  mockOrder.mockResolvedValue({ data: [], error: null });
  mockEqUserIdLoad.mockReturnValue({ order: mockOrder });
  mockEqChatIdLoad.mockReturnValue({ eq: mockEqUserIdLoad });
  mockSelectLoad.mockReturnValue({ eq: mockEqChatIdLoad });
  mockFrom.mockImplementation((table: string) => {
    if (table === "cockpit_chats") {
      return { insert: mockInsertChats, update: mockUpdate };
    }
    if (table === "cockpit_messages") {
      return { insert: mockInsertMessages, select: mockSelectLoad };
    }
    return {};
  });
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("createCockpitChatPersistence — env absent", () => {
  it("retourne null si NEXT_PUBLIC_SUPABASE_URL manquant", () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = SUPABASE_KEY;
    const result = createCockpitChatPersistence("user-1");
    expect(result).toBeNull();
  });

  it("retourne null si SUPABASE_SERVICE_ROLE_KEY manquant", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
    const result = createCockpitChatPersistence("user-1");
    expect(result).toBeNull();
  });

  it("retourne null si les deux env sont absents", () => {
    const result = createCockpitChatPersistence("user-1");
    expect(result).toBeNull();
  });
});

describe("createCockpitChatPersistence — env présent", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = SUPABASE_KEY;
  });

  it("retourne un objet non-null avec les méthodes ChatPersistence", () => {
    const persistence = createCockpitChatPersistence("user-abc");
    expect(persistence).not.toBeNull();
    expect(typeof persistence!.createChat).toBe("function");
    expect(typeof persistence!.loadMessages).toBe("function");
    expect(typeof persistence!.saveMessage).toBe("function");
  });

  it("createChat() retourne l'UUID créé par Supabase", async () => {
    mockSingle.mockResolvedValueOnce({ data: { id: "chat-uuid-42" }, error: null });

    const persistence = createCockpitChatPersistence("user-abc");
    const chatId = await persistence!.createChat();

    expect(chatId).toBe("chat-uuid-42");
    expect(mockFrom).toHaveBeenCalledWith("cockpit_chats");
  });

  it("createChat() lève une erreur si Supabase renvoie une erreur", async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: "DB error" } });

    const persistence = createCockpitChatPersistence("user-abc");
    await expect(persistence!.createChat()).rejects.toThrow(
      "[CockpitPersistence] createChat failed",
    );
  });

  it("loadMessages() retourne un tableau vide si Supabase renvoie []", async () => {
    mockOrder.mockResolvedValueOnce({ data: [], error: null });

    const persistence = createCockpitChatPersistence("user-abc");
    const messages = await persistence!.loadMessages("chat-1");

    expect(Array.isArray(messages)).toBe(true);
    expect(messages).toHaveLength(0);
  });

  it("loadMessages() mappe les rows en ChatMessage (id, role, content, createdAt)", async () => {
    const fakeRow = {
      id: "msg-1",
      role: "user",
      content: "Bonjour",
      created_at: "2026-05-19T10:00:00.000Z",
    };
    mockOrder.mockResolvedValueOnce({ data: [fakeRow], error: null });

    const persistence = createCockpitChatPersistence("user-abc");
    const messages = await persistence!.loadMessages("chat-1");

    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe("msg-1");
    expect(messages[0].role).toBe("user");
    expect(messages[0].content).toBe("Bonjour");
    expect(typeof messages[0].createdAt).toBe("number");
  });

  it("saveMessage() insère dans cockpit_messages sans erreur", async () => {
    mockInsertMessages.mockResolvedValueOnce({ error: null });

    const persistence = createCockpitChatPersistence("user-abc");
    await expect(
      persistence!.saveMessage("chat-1", {
        id: "msg-2",
        role: "assistant",
        content: "Réponse",
        createdAt: Date.now(),
      }),
    ).resolves.toBeUndefined();

    expect(mockFrom).toHaveBeenCalledWith("cockpit_messages");
  });

  it("saveMessage() lève une erreur si l'insert échoue", async () => {
    mockInsertMessages.mockResolvedValueOnce({ error: { message: "insert failed" } });

    const persistence = createCockpitChatPersistence("user-abc");
    await expect(
      persistence!.saveMessage("chat-1", {
        id: "msg-err",
        role: "user",
        content: "Test",
        createdAt: Date.now(),
      }),
    ).rejects.toThrow("[CockpitPersistence] saveMessage failed");
  });
});
