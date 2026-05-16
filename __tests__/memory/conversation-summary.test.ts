/**
 * F-104 — Tests safeParse fallback du résumé LLM.
 *
 * Vérifie que quand le LLM retourne un payload rejeté par `SummarySchema`
 * (JSON brut, fences markdown, dépassement du cap 1 200 chars, etc.) on
 * retombe sur `conversationText` brut — pas de propagation d'output dégénéré.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const chatMock = vi.fn();
const isOpenMock = vi.fn();
const recordSuccessMock = vi.fn();
const recordFailureMock = vi.fn();

vi.mock("@/lib/llm/circuit-breaker", () => ({
  defaultCircuitBreaker: {
    isOpen: (provider: string, tenantId?: string) => isOpenMock(provider, tenantId),
    recordSuccess: (provider: string, tenantId?: string) => recordSuccessMock(provider, tenantId),
    recordFailure: (provider: string, err: Error, tenantId?: string) =>
      recordFailureMock(provider, err, tenantId),
  },
}));

vi.mock("@/lib/llm/router", () => ({
  getProvider: () => ({ name: "kimi", chat: chatMock }),
}));

vi.mock("@/lib/observability/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { chatWithCircuitBreaker } from "@/lib/llm/safe-chat";
import { SummarySchema } from "@/lib/memory/conversation-summary";

// Réplique la closure `parse` du `compress(messages)` interne, qui
// implémente exactement la branche safeParse + fallback à tester.
async function runCompressLike(llmOutput: string, conversationText: string): Promise<string> {
  return chatWithCircuitBreaker<string>({
    context: "memory/summary",
    chatRequest: {
      model: "kimi-k2.5",
      max_tokens: 250,
      messages: [{ role: "user", content: "noop" }],
    },
    fallback: conversationText,
    parse: (res) => {
      const raw = (res.content ?? "").trim();
      if (!raw) return conversationText;
      const parsed = SummarySchema.safeParse(raw);
      if (!parsed.success) return conversationText;
      return parsed.data;
    },
  });
}

describe("F-104 — SummarySchema fallback", () => {
  beforeEach(() => {
    isOpenMock.mockReset();
    isOpenMock.mockReturnValue(false);
    chatMock.mockReset();
    recordSuccessMock.mockReset();
    recordFailureMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("safeParse rejette un output JSON brut → fallback retourne conversationText", async () => {
    // Le SummarySchema rejette toute string commençant par `{`, `[`, ou `<`
    // (refine `summary_unexpected_structure`).
    const llmOutput = '{"summary":"Décision prise: lancer Hearst v2 lundi."}';
    chatMock.mockResolvedValue({
      content: llmOutput,
      model: "kimi-k2.5",
      provider: "kimi",
      tokens_in: 30,
      tokens_out: 25,
      cost_usd: 0,
      latency_ms: 50,
    });

    const conversationText =
      "Utilisateur: salut\n\nAssistant: hello\n\nUtilisateur: décision pour lundi?";

    const result = await runCompressLike(llmOutput, conversationText);

    // safeParse a échoué → fallback
    expect(result).toBe(conversationText);

    // Le contrat invariant : un JSON brut DOIT être rejeté.
    const direct = SummarySchema.safeParse(llmOutput);
    expect(direct.success).toBe(false);
  });

  it("safeParse rejette un output > 1 200 chars (cap max) → fallback retourne conversationText", async () => {
    // Pad au-dessus du SUMMARY_MAX_CHARS (1 200) → refine `summary_too_long`.
    const llmOutput = "Résumé long. ".repeat(120); // ~1 560 chars
    expect(llmOutput.length).toBeGreaterThan(1_200);

    chatMock.mockResolvedValue({
      content: llmOutput,
      model: "kimi-k2.5",
      provider: "kimi",
      tokens_in: 30,
      tokens_out: 400,
      cost_usd: 0,
      latency_ms: 80,
    });

    const conversationText = "Utilisateur: x\n\nAssistant: y";

    const result = await runCompressLike(llmOutput, conversationText);

    expect(result).toBe(conversationText);

    const direct = SummarySchema.safeParse(llmOutput);
    expect(direct.success).toBe(false);
  });

  it("safeParse rejette un output avec fence markdown → fallback retourne conversationText", async () => {
    // Refine `summary_markdown_fence` : commence par ```
    const llmOutput = '```json\n{"summary":"bla"}\n```';

    chatMock.mockResolvedValue({
      content: llmOutput,
      model: "kimi-k2.5",
      provider: "kimi",
      tokens_in: 10,
      tokens_out: 10,
      cost_usd: 0,
      latency_ms: 10,
    });

    const conversationText = "Utilisateur: ping\n\nAssistant: pong";

    const result = await runCompressLike(llmOutput, conversationText);

    expect(result).toBe(conversationText);

    const direct = SummarySchema.safeParse(llmOutput);
    expect(direct.success).toBe(false);
  });

  it("safeParse accepte un résumé conforme (2-3 phrases denses, < 1 200 chars)", async () => {
    const llmOutput =
      "Adrien décide de lancer Hearst v2 lundi. L'équipe valide la stack Next.js 15. Prochaine action: setup CI Vercel.";

    chatMock.mockResolvedValue({
      content: llmOutput,
      model: "kimi-k2.5",
      provider: "kimi",
      tokens_in: 30,
      tokens_out: 25,
      cost_usd: 0,
      latency_ms: 40,
    });

    const conversationText = "Utilisateur: roadmap?\n\nAssistant: ok lundi";

    const result = await runCompressLike(llmOutput, conversationText);

    expect(result).toBe(llmOutput);
  });
});
