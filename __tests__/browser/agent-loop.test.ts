/**
 * Browser Agent Loop (vague 9, action #4) — tests avec OpenAI mocké.
 *
 * Couvre :
 *  - Sequence multi-step : navigate → click → done
 *  - Tool execution mappée correctement à PlaywrightPage
 *  - extract retourne les données dans extractedData
 *  - abort signal stoppe la boucle
 *  - 5 échecs consécutifs → abort no-progress
 *  - max steps respecté
 *  - Pas de clé OpenAI → abort propre
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { runAgentLoop } from "@/lib/browser/agent-loop";
import type { PlaywrightPage } from "@/lib/browser/playwright-bridge";
import { createFakePage } from "@/lib/browser/playwright-bridge";

// ── Helpers : mock OpenAI ────────────────────────────────────

interface ScriptedToolCall {
  name: string;
  input: Record<string, unknown>;
}

type OpenAIClientParam = Parameters<typeof runAgentLoop>[0]["openaiClient"];

/** Construit une réponse chat.completions au format OpenAI avec un tool_call. */
function toolCallResponse(idx: number, name: string, input: Record<string, unknown>) {
  return {
    id: `chatcmpl-${idx}`,
    choices: [
      {
        index: 0,
        finish_reason: "tool_calls" as const,
        message: {
          role: "assistant" as const,
          content: null,
          tool_calls: [
            {
              id: `call_${idx}`,
              type: "function" as const,
              function: { name, arguments: JSON.stringify(input) },
            },
          ],
        },
      },
    ],
  };
}

/** Réponse texte seule (pas de tool_call) → termine la boucle. */
function textResponse(idx: number, text: string) {
  return {
    id: `chatcmpl-${idx}`,
    choices: [
      {
        index: 0,
        finish_reason: "stop" as const,
        message: { role: "assistant" as const, content: text, tool_calls: undefined },
      },
    ],
  };
}

/**
 * Simule un client OpenAI qui retourne une séquence prédéfinie de tool_calls.
 * Chaque appel à `chat.completions.create` renvoie la prochaine étape de
 * `script`. Quand le script est épuisé, retourne une réponse texte vide.
 */
function makeMockClient(script: ScriptedToolCall[]) {
  let cursor = 0;
  return {
    chat: {
      completions: {
        create: vi.fn(async () => {
          const next = script[cursor];
          cursor += 1;
          if (!next) return textResponse(cursor, "Done.");
          return toolCallResponse(cursor, next.name, next.input);
        }),
      },
    },
  };
}

// ── Helpers : Page espionne ──────────────────────────────────

function makeSpyPage(overrides: Partial<PlaywrightPage> = {}): PlaywrightPage {
  const base = createFakePage({
    url: "https://example.com",
    title: "Example",
    content: "<html><body>Welcome</body></html>",
  });
  return {
    ...base,
    goto: vi.fn(base.goto.bind(base)),
    click: vi.fn(base.click.bind(base)),
    fill: vi.fn(base.fill.bind(base)),
    waitForLoadState: vi.fn(base.waitForLoadState.bind(base)),
    title: vi.fn(base.title.bind(base)),
    content: vi.fn(base.content.bind(base)),
    url: vi.fn(base.url.bind(base)),
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────

describe("runAgentLoop", () => {
  beforeEach(() => {
    // Pas besoin de clé pour les tests — le mockClient est passé en param
  });

  it("exécute une sequence navigate → done", async () => {
    const client = makeMockClient([
      { name: "navigate", input: { url: "https://acme.com", reason: "open homepage" } },
      { name: "done", input: { summary: "Page loaded", success: true } },
    ]);
    const page = makeSpyPage();
    const result = await runAgentLoop({
      task: "Open https://acme.com",
      page,
      openaiClient: client as unknown as OpenAIClientParam,
    });

    expect(result.steps).toHaveLength(2);
    expect(result.steps[0].tool).toBe("navigate");
    expect(result.steps[0].result.ok).toBe(true);
    expect(result.steps[1].tool).toBe("done");
    expect(result.success).toBe(true);
    expect(result.summary).toBe("Page loaded");
    expect(page.goto).toHaveBeenCalledWith(
      "https://acme.com",
      expect.objectContaining({ waitUntil: "domcontentloaded" }),
    );
  });

  it("rejette navigate avec URL invalide", async () => {
    const client = makeMockClient([
      { name: "navigate", input: { url: "not-a-url", reason: "x" } },
      { name: "done", input: { summary: "Failed nav", success: false } },
    ]);
    const page = makeSpyPage();
    const result = await runAgentLoop({
      task: "x",
      page,
      openaiClient: client as unknown as OpenAIClientParam,
    });

    expect(result.steps[0].result.ok).toBe(false);
    expect(result.steps[0].result.error).toContain("invalid url");
    expect(page.goto).not.toHaveBeenCalled();
  });

  it("appelle click sur la page avec le bon selector", async () => {
    const client = makeMockClient([
      { name: "click", input: { selector: "button.submit", reason: "submit form" } },
      { name: "done", input: { summary: "Clicked", success: true } },
    ]);
    const page = makeSpyPage();
    await runAgentLoop({
      task: "Click submit",
      page,
      openaiClient: client as unknown as OpenAIClientParam,
    });
    expect(page.click).toHaveBeenCalledWith(
      "button.submit",
      expect.objectContaining({ timeout: 10_000 }),
    );
  });

  it("appelle fill avec selector + value", async () => {
    const client = makeMockClient([
      {
        name: "fill",
        input: { selector: "input[name=email]", value: "test@x.com", reason: "fill email" },
      },
      { name: "done", input: { summary: "Filled", success: true } },
    ]);
    const page = makeSpyPage();
    await runAgentLoop({
      task: "Fill email",
      page,
      openaiClient: client as unknown as OpenAIClientParam,
    });
    expect(page.fill).toHaveBeenCalledWith(
      "input[name=email]",
      "test@x.com",
      expect.objectContaining({ timeout: 10_000 }),
    );
  });

  it("retourne extractedData quand le tool extract est utilisé", async () => {
    const fakeContent = "<html><body><h1>Acme</h1><p>Price: $99</p></body></html>";
    const page = makeSpyPage({
      content: vi.fn(async () => fakeContent),
    });
    // Séquence : extract (tool_call) → JSON (texte, appel interne) → done (tool_call)
    const client = {
      chat: {
        completions: {
          create: vi
            .fn()
            .mockResolvedValueOnce(
              toolCallResponse(1, "extract", { instruction: "page title and price" }),
            )
            .mockResolvedValueOnce(textResponse(2, '{"title":"Acme","price":"$99"}'))
            .mockResolvedValueOnce(
              toolCallResponse(3, "done", { summary: "Extracted", success: true }),
            ),
        },
      },
    };
    const result = await runAgentLoop({
      task: "Extract title and price",
      page,
      openaiClient: client as unknown as OpenAIClientParam,
    });
    expect(result.extractedData).toEqual({ title: "Acme", price: "$99" });
    expect(result.success).toBe(true);
  });

  it("respecte maxSteps et marque aborted quand le cap est atteint", async () => {
    // Script infini de clicks — l'agent ne dira jamais "done"
    const infiniteClicks: ScriptedToolCall[] = Array.from({ length: 30 }, () => ({
      name: "click",
      input: { selector: "button", reason: "x" },
    }));
    const client = makeMockClient(infiniteClicks);
    const page = makeSpyPage();
    const result = await runAgentLoop({
      task: "Spam click",
      page,
      maxSteps: 5,
      openaiClient: client as unknown as OpenAIClientParam,
    });
    expect(result.steps).toHaveLength(5);
    expect(result.aborted).toBe(true);
    expect(result.summary).toContain("cap");
  });

  it("appelle onStep callback pour chaque step exécuté", async () => {
    const client = makeMockClient([
      { name: "navigate", input: { url: "https://x.com", reason: "x" } },
      { name: "click", input: { selector: "a", reason: "x" } },
      { name: "done", input: { summary: "ok", success: true } },
    ]);
    const page = makeSpyPage();
    const onStep = vi.fn();
    await runAgentLoop({
      task: "x",
      page,
      onStep,
      openaiClient: client as unknown as OpenAIClientParam,
    });
    expect(onStep).toHaveBeenCalledTimes(3);
    expect(onStep.mock.calls[0][0].tool).toBe("navigate");
    expect(onStep.mock.calls[1][0].tool).toBe("click");
    expect(onStep.mock.calls[2][0].tool).toBe("done");
  });

  it("abort via signal externe stoppe immédiatement", async () => {
    const controller = new AbortController();
    const client = {
      chat: {
        completions: {
          create: vi.fn(async () => {
            controller.abort();
            return toolCallResponse(1, "navigate", { url: "https://x.com", reason: "x" });
          }),
        },
      },
    };
    const page = makeSpyPage();
    // Pre-abort
    controller.abort();
    const result = await runAgentLoop({
      task: "x",
      page,
      abortSignal: controller.signal,
      openaiClient: client as unknown as OpenAIClientParam,
    });
    expect(result.aborted).toBe(true);
    expect(result.summary).toContain("interrompu");
  });

  it("abort no-progress après 5 échecs consécutifs", async () => {
    // 6 fills avec selector vide → chacun échoue. L'agent doit abort au 5e.
    const failingScript: ScriptedToolCall[] = Array.from({ length: 10 }, () => ({
      name: "fill",
      input: { selector: "", value: "x", reason: "x" },
    }));
    const client = makeMockClient(failingScript);
    const page = makeSpyPage();
    const result = await runAgentLoop({
      task: "x",
      page,
      maxSteps: 20,
      openaiClient: client as unknown as OpenAIClientParam,
    });
    expect(result.aborted).toBe(true);
    expect(result.summary).toContain("échec");
    // Au plus 5 steps exécutés avant l'abort
    expect(result.steps.length).toBeLessThanOrEqual(5);
  });

  it("retourne aborted sans clé OpenAI ni client mocké", async () => {
    const original = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const page = makeSpyPage();
      const result = await runAgentLoop({ task: "x", page });
      expect(result.aborted).toBe(true);
      expect(result.summary).toContain("OPENAI_API_KEY");
    } finally {
      if (original) process.env.OPENAI_API_KEY = original;
    }
  });

  it("text-only response (pas de tool_call) termine la boucle", async () => {
    const client = {
      chat: {
        completions: {
          create: vi.fn(async () => textResponse(1, "Je n'ai pas assez d'info pour agir.")),
        },
      },
    };
    const page = makeSpyPage();
    const result = await runAgentLoop({
      task: "x",
      page,
      openaiClient: client as unknown as OpenAIClientParam,
    });
    expect(result.steps).toHaveLength(0);
    expect(result.summary).toContain("pas assez");
  });
});
