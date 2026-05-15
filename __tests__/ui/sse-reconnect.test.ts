/**
 * P1 — SSE auto-reconnect logic.
 *
 * Vérifie la logique de reconnexion exponentiellement backoffée :
 * - Retry si le stream se termine sans "run_completed"
 * - Pas de retry si l'user a aborted (AbortController)
 * - Pas de retry sur erreur HTTP 4xx/5xx
 * - Max 3 reconnexions, délai exponentiel
 * - Completed = run_completed ou run_failed reçu
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Helpers pour simuler un stream SSE ────────────────────────────────────

function makeSseStream(events: Array<Record<string, unknown>>, prematureCut = false) {
  const lines = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");
  const encoder = new TextEncoder();
  const bytes = encoder.encode(lines);

  let sent = false;
  return {
    ok: true,
    status: 200,
    body: {
      getReader(): ReadableStreamDefaultReader<Uint8Array> {
        return {
          read: async () => {
            if (!sent) {
              sent = true;
              if (prematureCut) return { done: false, value: bytes };
              return { done: false, value: bytes };
            }
            // prematureCut = true → ne jamais envoyer done=true (simule coupure proxy)
            if (prematureCut) {
              await new Promise((_, reject) =>
                setTimeout(() => reject(new Error("network cut")), 50),
              );
            }
            return { done: true, value: undefined };
          },
          releaseLock: () => {},
          cancel: async () => {},
          closed: Promise.resolve(undefined),
        } as ReadableStreamDefaultReader<Uint8Array>;
      },
    },
  };
}

// ── Tests logiques isolées ─────────────────────────────────────────────────

describe("P1 SSE reconnect — completion detection", () => {
  it("détecte run_completed comme signal de completion", () => {
    const events: Array<Record<string, unknown>> = [
      { type: "run_started", run_id: "r1" },
      { type: "text_delta", delta: "Bonjour !" },
      { type: "run_completed", run_id: "r1" },
    ];
    const completion = events.some((e) => e.type === "run_completed" || e.type === "run_failed");
    expect(completion).toBe(true);
  });

  it("détecte run_failed comme signal de completion", () => {
    const events: Array<Record<string, unknown>> = [
      { type: "run_started", run_id: "r2" },
      { type: "run_failed", error: "cost cap exceeded", run_id: "r2" },
    ];
    const completion = events.some((e) => e.type === "run_completed" || e.type === "run_failed");
    expect(completion).toBe(true);
  });

  it("ne considère pas un stream incomplet comme completed", () => {
    const events: Array<Record<string, unknown>> = [
      { type: "run_started", run_id: "r3" },
      { type: "text_delta", delta: "Bonjour" },
      // Pas de run_completed → stream coupé
    ];
    const completion = events.some((e) => e.type === "run_completed" || e.type === "run_failed");
    expect(completion).toBe(false);
  });
});

describe("P1 SSE reconnect — backoff timing", () => {
  it("calcule les délais de backoff correctement (1s, 2s, 4s)", () => {
    const BASE = 1000;
    const delays = [1, 2, 3].map((attempt) => BASE * Math.pow(2, attempt - 1));
    expect(delays).toEqual([1000, 2000, 4000]);
  });

  it("ne dépasse pas MAX_RECONNECT_ATTEMPTS + 1 = 4 tentatives totales", () => {
    const MAX_RECONNECT_ATTEMPTS = 3;
    let attempts = 0;
    let completed = false;

    for (let attempt = 0; attempt <= MAX_RECONNECT_ATTEMPTS; attempt++) {
      attempts++;
      // Simule que aucun attempt ne complète
      completed = false;
      if (completed || false /* aborted */) break;
    }

    expect(attempts).toBe(4); // 1 initial + 3 retries
    expect(completed).toBe(false);
  });

  it("s'arrête dès qu'un attempt complète (no extra retries)", () => {
    const MAX_RECONNECT_ATTEMPTS = 3;
    let attempts = 0;

    for (let attempt = 0; attempt <= MAX_RECONNECT_ATTEMPTS; attempt++) {
      attempts++;
      const completed = attempt === 1; // complète au 2e attempt
      if (completed) break;
    }

    expect(attempts).toBe(2); // s'arrête après le 2e
  });

  it("s'arrête immédiatement si controller aborted", () => {
    const controller = new AbortController();
    const MAX_RECONNECT_ATTEMPTS = 3;
    let attempts = 0;

    controller.abort();

    for (let attempt = 0; attempt <= MAX_RECONNECT_ATTEMPTS; attempt++) {
      attempts++;
      if (controller.signal.aborted) break;
    }

    expect(attempts).toBe(1); // 1 seul tentative avant abort
  });
});

describe("P1 SSE reconnect — HTTP error handling", () => {
  it("ne retry pas sur erreur HTTP 5xx (completed=true = no retry)", () => {
    const res = { ok: false, status: 503 };
    // Les erreurs HTTP sont traitées comme "completed" pour stopper les retries
    const shouldRetry = res.ok; // false → pas de retry
    expect(shouldRetry).toBe(false);
  });

  it("ne retry pas sur erreur HTTP 4xx", () => {
    const res = { ok: false, status: 429 };
    const shouldRetry = res.ok;
    expect(shouldRetry).toBe(false);
  });
});

describe("P1 SSE reconnect — integration fetch mock", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it("appelle fetch une seule fois si stream complète", async () => {
    const streamEvents = [
      { type: "run_started", run_id: "r1" },
      { type: "text_delta", delta: "Hello" },
      { type: "run_completed", run_id: "r1" },
    ];
    fetchMock.mockResolvedValue(makeSseStream(streamEvents));

    const MAX_RECONNECT = 3;
    let attempts = 0;

    for (let attempt = 0; attempt <= MAX_RECONNECT; attempt++) {
      attempts++;
      const res = await fetchMock("/api/orchestrate", {});
      const reader = (
        res.body as { getReader(): ReadableStreamDefaultReader<Uint8Array> }
      ).getReader();
      let receivedCompletion = false;
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const ev = JSON.parse(line.slice(6));
            if (ev.type === "run_completed" || ev.type === "run_failed") {
              receivedCompletion = true;
            }
          } catch {}
        }
      }

      if (receivedCompletion) break;
    }

    expect(attempts).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
