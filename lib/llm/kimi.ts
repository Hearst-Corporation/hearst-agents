/**
 * Provider Kimi — Moonshot AI exposé via hypercli (proxy OpenAI-compatible).
 *
 * ATTENTION : l'endpoint `https://api.hypercli.com/v1` est un proxy non-officiel.
 * Vérifier la disponibilité du service avant tout déploiement prod et surveiller
 * les éventuelles dérives de comportement par rapport à l'API Moonshot native.
 *
 * Modèles supportés : kimi-k2, kimi-k2.5, kimi-k2.6 (cf. lib/llm/pricing.ts)
 */

import OpenAI from "openai";
import { computeCostUsd } from "./pricing";
import { defaultRateLimiter } from "./rate-limiter";
import { CHAT_TIMEOUT_MS, makeAbortSignal, STREAM_TIMEOUT_MS } from "./timeout";
import type { ChatRequest, ChatResponse, LLMProvider, StreamChunk } from "./types";

// Benchmark HyperCLI 2026-05-18 : non-streaming 360ms vs streaming 630ms sur 15 tokens.
// En dessous de ce seuil, on court-circuite vers l'API non-streaming.
const STREAM_SHORT_THRESHOLD_TOKENS = 80;

export class KimiProvider implements LLMProvider {
  readonly name = "kimi";
  private client: OpenAI;

  constructor() {
    const apiKey =
      process.env.HYPERCLI_API_KEY ??
      process.env.KIMI_API_KEY ??
      (process.env.NODE_ENV === "test" ? "test-placeholder" : "build-placeholder");
    this.client = new OpenAI({
      apiKey,
      baseURL: process.env.KIMI_BASE_URL ?? "https://api.hypercli.com/v1",
      maxRetries: 0, // router.retryWithBackoff couvre la connexion initiale ; mid-stream 429 non-retryable de toute façon
    });
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const start = Date.now();
    const timeoutMs = req.timeoutMs ?? CHAT_TIMEOUT_MS;
    const signal = makeAbortSignal(timeoutMs, req.signal);

    await this.maybeWaitForRateLimit();

    const { data: res, response } = await this.client.chat.completions
      .create(
        {
          model: req.model,
          messages: req.messages.map((m) => ({
            role: m.role as "system" | "user" | "assistant",
            content: m.content,
          })),
          temperature: req.temperature,
          max_tokens: req.max_tokens,
          top_p: req.top_p,
        },
        { signal },
      )
      .withResponse();

    this.recordRateLimitHeaders(response);

    const tokensIn = res.usage?.prompt_tokens ?? 0;
    const tokensOut = res.usage?.completion_tokens ?? 0;

    return {
      content: res.choices[0]?.message?.content ?? "",
      model: res.model,
      provider: this.name,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      cost_usd: computeCostUsd("kimi", res.model, {
        input_tokens: tokensIn,
        output_tokens: tokensOut,
      }),
      latency_ms: Date.now() - start,
    };
  }

  async *streamChat(req: ChatRequest): AsyncGenerator<StreamChunk> {
    // Court-circuit : appel non-streaming pour les réponses courtes (max_tokens ≤ STREAM_SHORT_THRESHOLD_TOKENS).
    if (
      req.max_tokens !== undefined &&
      req.max_tokens > 0 &&
      req.max_tokens <= STREAM_SHORT_THRESHOLD_TOKENS
    ) {
      const res = await this.chat(req);
      if (res.content) yield { delta: res.content, done: false };
      yield {
        delta: "",
        done: true,
        cost_usd: res.cost_usd,
        tokens_in: res.tokens_in,
        tokens_out: res.tokens_out,
      };
      return;
    }

    const timeoutMs = req.timeoutMs ?? STREAM_TIMEOUT_MS;
    const signal = makeAbortSignal(timeoutMs, req.signal);

    await this.maybeWaitForRateLimit();

    const { data: stream, response } = await this.client.chat.completions
      .create(
        {
          model: req.model,
          messages: req.messages.map((m) => ({
            role: m.role as "system" | "user" | "assistant",
            content: m.content,
          })),
          temperature: req.temperature,
          max_tokens: req.max_tokens,
          top_p: req.top_p,
          stream: true,
          stream_options: { include_usage: true },
        },
        { signal },
      )
      .withResponse();

    this.recordRateLimitHeaders(response);

    let tokensIn = 0;
    let tokensOut = 0;
    let pendingFinish = false;

    for await (const chunk of stream) {
      if (chunk.usage) {
        tokensIn = chunk.usage.prompt_tokens ?? 0;
        tokensOut = chunk.usage.completion_tokens ?? 0;
      }
      const delta = chunk.choices[0]?.delta?.content ?? "";
      const finishReason = chunk.choices[0]?.finish_reason;
      if (delta) {
        yield { delta, done: false };
      }
      if (finishReason !== null && finishReason !== undefined) {
        pendingFinish = true;
      }
    }

    if (pendingFinish) {
      const cost_usd = computeCostUsd("kimi", req.model, {
        input_tokens: tokensIn,
        output_tokens: tokensOut,
      });
      yield { delta: "", done: true, cost_usd, tokens_in: tokensIn, tokens_out: tokensOut };
    }
  }

  /**
   * Enregistre les headers `x-ratelimit-*` / `retry-after` pour le backoff
   * proactif. Tolérant : un échec de parsing ne casse pas l'appel utilisateur.
   */
  private recordRateLimitHeaders(response: Response | undefined): void {
    try {
      if (response?.headers) {
        defaultRateLimiter.recordHeaders("kimi", response.headers);
      }
    } catch (err) {
      console.warn("[Kimi] recordHeaders failed:", err);
    }
  }

  /**
   * Attend si le rate-limiter recommande un délai. Ne bloque jamais en cas
   * d'erreur.
   */
  private async maybeWaitForRateLimit(): Promise<void> {
    try {
      const delay = defaultRateLimiter.getNextDelay("kimi");
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    } catch {
      // best-effort
    }
  }
}
