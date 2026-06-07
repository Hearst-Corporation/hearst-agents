/**
 * Tests unitaires pour tryLiteAgent (lite-agent.ts).
 *
 * Couverture :
 * (a) lecture simple → {text, slug}
 * (b) fallback JSON (fallback:true) → null
 * (c) slug write détecté → null
 * (d) execute !ok → null
 * (e) erreur LLM (chatWithCircuitBreaker retourne null) → null (fail-soft)
 * (f) aucune connexion active → null
 * (g) slug non dans ESSENTIAL_READS → null
 */

import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/connectors/composio/connections", () => ({
  listConnections: vi.fn(),
}));

vi.mock("@/lib/connectors/composio/client", () => ({
  executeComposioAction: vi.fn(),
}));

vi.mock("@/lib/llm/safe-chat", () => ({
  chatWithCircuitBreaker: vi.fn(),
}));

vi.mock("@/lib/engine/orchestrator/conversational-fastpath", () => ({
  resolveConversationalFastpathConfig: vi.fn(() => ({
    provider: "kimi",
    apiKey: "test-kimi-key",
    baseURL: "https://api.moonshot.cn/v1",
    model: "kimi-k2.5",
  })),
}));

vi.mock("@/lib/observability/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ── Imports après les mocks ───────────────────────────────────────────────────

import { executeComposioAction } from "@/lib/connectors/composio/client";
import { listConnections } from "@/lib/connectors/composio/connections";
import { resolveConversationalFastpathConfig } from "@/lib/engine/orchestrator/conversational-fastpath";
import { tryLiteAgent } from "@/lib/engine/orchestrator/lite-agent";
import { chatWithCircuitBreaker } from "@/lib/llm/safe-chat";

const mockListConnections = listConnections as Mock;
const mockExecuteComposioAction = executeComposioAction as Mock;
const mockChatWithCircuitBreaker = chatWithCircuitBreaker as Mock;
const mockResolveConversationalFastpathConfig = resolveConversationalFastpathConfig as Mock;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Connecte une app ACTIVE */
function activeConnection(appName: string) {
  return { id: `conn-${appName}`, appName, status: "ACTIVE" };
}

/**
 * Configure chatWithCircuitBreaker pour retourner une séquence de valeurs.
 * Premier appel = classify, deuxième = summarize.
 */
function setupChat(classifyReturn: unknown, summarizeReturn: unknown) {
  mockChatWithCircuitBreaker
    .mockImplementationOnce(({ parse }: { parse: (res: { content: string }) => unknown }) => {
      // Simuler le comportement parse() avec une réponse LLM
      if (classifyReturn === null) return Promise.resolve(null);
      const content =
        typeof classifyReturn === "string" ? classifyReturn : JSON.stringify(classifyReturn);
      return Promise.resolve(parse({ content }));
    })
    .mockImplementationOnce(({ parse }: { parse: (res: { content: string }) => unknown }) => {
      if (summarizeReturn === null) return Promise.resolve(null);
      return Promise.resolve(parse({ content: summarizeReturn as string }));
    });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks();
});

describe("tryLiteAgent", () => {
  // ─── (a) lecture simple → {text, slug} ─────────────────────────────────────
  it("(a) lecture simple Gmail → {text, slug}", async () => {
    mockListConnections.mockResolvedValue([activeConnection("gmail")]);
    setupChat(
      JSON.stringify({ slug: "GMAIL_FETCH_EMAILS", args: { max_results: 10 } }),
      "Voici vos 10 derniers emails.",
    );
    mockExecuteComposioAction.mockResolvedValue({
      ok: true,
      data: { emails: [{ subject: "Test", from: "a@b.com" }] },
    });

    const result = await tryLiteAgent({
      message: "lis mes mails",
      entityId: "user-123",
    });

    expect(result).not.toBeNull();
    expect(result?.slug).toBe("GMAIL_FETCH_EMAILS");
    expect(result?.text).toBe("Voici vos 10 derniers emails.");
    expect(mockExecuteComposioAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "GMAIL_FETCH_EMAILS",
        entityId: "user-123",
      }),
    );
  });

  // ─── (b) fallback JSON → null ───────────────────────────────────────────────
  it("(b) fallback:true dans classify → null, pas d'appel execute", async () => {
    mockListConnections.mockResolvedValue([activeConnection("gmail")]);
    setupChat(JSON.stringify({ fallback: true }), "irrelevant");

    const result = await tryLiteAgent({
      message: "réponds à mon dernier mail",
      entityId: "user-123",
    });

    expect(result).toBeNull();
    expect(mockExecuteComposioAction).not.toHaveBeenCalled();
  });

  // ─── (c) slug write détecté → null ─────────────────────────────────────────
  it("(c) slug avec SEND détecté → null (write guard)", async () => {
    mockListConnections.mockResolvedValue([activeConnection("gmail")]);
    // K2.5 retourne un slug d'écriture (hallucination ou mauvaise détection)
    setupChat(
      JSON.stringify({ slug: "GMAIL_SEND_EMAIL", args: { to: "a@b.com", subject: "Hi" } }),
      "irrelevant",
    );

    const result = await tryLiteAgent({
      message: "envoie un email à Pierre",
      entityId: "user-123",
    });

    expect(result).toBeNull();
    expect(mockExecuteComposioAction).not.toHaveBeenCalled();
  });

  // ─── (d) execute !ok → null ─────────────────────────────────────────────────
  it("(d) executeComposioAction !ok → null", async () => {
    mockListConnections.mockResolvedValue([activeConnection("gmail")]);
    setupChat(JSON.stringify({ slug: "GMAIL_FETCH_EMAILS", args: {} }), "irrelevant");
    mockExecuteComposioAction.mockResolvedValue({
      ok: false,
      error: "AUTH_REQUIRED",
      errorCode: "AUTH_REQUIRED",
    });

    const result = await tryLiteAgent({
      message: "montre mon inbox",
      entityId: "user-123",
    });

    expect(result).toBeNull();
  });

  // ─── (e) erreur LLM (classify null) → null (fail-soft) ─────────────────────
  it("(e) erreur LLM classify → null (fail-soft, pas de throw)", async () => {
    mockListConnections.mockResolvedValue([activeConnection("gmail")]);
    // chatWithCircuitBreaker retourne null (circuit ouvert ou parse error)
    mockChatWithCircuitBreaker.mockResolvedValue(null);

    await expect(
      tryLiteAgent({ message: "lis mes mails", entityId: "user-123" }),
    ).resolves.toBeNull();

    expect(mockExecuteComposioAction).not.toHaveBeenCalled();
  });

  // ─── (f) aucune connexion active → null ────────────────────────────────────
  it("(f) aucune connexion active → null", async () => {
    mockListConnections.mockResolvedValue([{ id: "conn-1", appName: "gmail", status: "EXPIRED" }]);

    const result = await tryLiteAgent({
      message: "lis mes mails",
      entityId: "user-123",
    });

    expect(result).toBeNull();
    expect(mockChatWithCircuitBreaker).not.toHaveBeenCalled();
  });

  // ─── (g) slug hors ESSENTIAL_READS → null ──────────────────────────────────
  it("(g) slug absent de ESSENTIAL_READS (app inconnue) → null", async () => {
    // "notion" est dans ESSENTIAL_READS mais slug inventé par K2.5 n'en fait pas partie
    mockListConnections.mockResolvedValue([activeConnection("gmail")]);
    setupChat(JSON.stringify({ slug: "GMAIL_SOMETHING_INVENTED", args: {} }), "irrelevant");

    const result = await tryLiteAgent({
      message: "lis mes mails",
      entityId: "user-123",
    });

    expect(result).toBeNull();
    expect(mockExecuteComposioAction).not.toHaveBeenCalled();
  });

  // ─── (h) exception interne → null (fail-soft total) ────────────────────────
  it("(h) listConnections throw → null (fail-soft total, pas de throw)", async () => {
    mockListConnections.mockRejectedValue(new Error("Network error"));

    await expect(
      tryLiteAgent({ message: "lis mes mails", entityId: "user-123" }),
    ).resolves.toBeNull();
  });

  // ─── (i) slug write CREATE → null ──────────────────────────────────────────
  it("(i) slug avec CREATE → null (write guard)", async () => {
    mockListConnections.mockResolvedValue([activeConnection("googlecalendar")]);
    setupChat(
      JSON.stringify({ slug: "GOOGLECALENDAR_CREATE_EVENT", args: { summary: "Meeting" } }),
      "irrelevant",
    );

    const result = await tryLiteAgent({
      message: "crée un événement calendrier",
      entityId: "user-123",
    });

    expect(result).toBeNull();
    expect(mockExecuteComposioAction).not.toHaveBeenCalled();
  });

  // ─── (j) multiples apps connectées — lit depuis la bonne ───────────────────
  it("(j) user avec gmail + slack connectés → route Slack si demandé", async () => {
    mockListConnections.mockResolvedValue([activeConnection("gmail"), activeConnection("slack")]);
    setupChat(
      JSON.stringify({ slug: "SLACK_LIST_ALL_CHANNELS", args: {} }),
      "Voici vos canaux Slack.",
    );
    mockExecuteComposioAction.mockResolvedValue({
      ok: true,
      data: { channels: [{ name: "general" }] },
    });

    const result = await tryLiteAgent({
      message: "liste mes canaux Slack",
      entityId: "user-123",
    });

    expect(result).not.toBeNull();
    expect(result?.slug).toBe("SLACK_LIST_ALL_CHANNELS");
    expect(result?.text).toBe("Voici vos canaux Slack.");
  });

  // ─── (k) Kimi OFF (pas de KIMI_API_KEY) → OpenAI cheap, pas d'échec ────────
  it("(k) Kimi OFF → lite-agent appelle le LLM avec un model OpenAI cheap (pas d'échec immédiat)", async () => {
    // Simuler KIMI_API_KEY absent → resolveConversationalFastpathConfig retourne OpenAI
    mockResolveConversationalFastpathConfig.mockReturnValueOnce({
      provider: "openai",
      apiKey: "sk-test-openai",
      baseURL: "https://api.openai.com/v1",
      model: "gpt-4.1-mini",
    });

    mockListConnections.mockResolvedValue([activeConnection("gmail")]);
    setupChat(
      JSON.stringify({ slug: "GMAIL_FETCH_EMAILS", args: { max_results: 5 } }),
      "Voici vos 5 derniers emails.",
    );
    mockExecuteComposioAction.mockResolvedValue({
      ok: true,
      data: { emails: [{ subject: "Hello", from: "test@test.com" }] },
    });

    const result = await tryLiteAgent({
      message: "lis mes mails",
      entityId: "user-456",
    });

    // Le lite-agent doit réussir malgré Kimi OFF — provider OpenAI cheap pris
    expect(result).not.toBeNull();
    expect(result?.slug).toBe("GMAIL_FETCH_EMAILS");
    expect(result?.text).toBe("Voici vos 5 derniers emails.");

    // Vérifier que chatWithCircuitBreaker a été appelé avec provider "openai"
    expect(mockChatWithCircuitBreaker).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "openai" }),
    );
  });
});
