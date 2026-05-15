import OpenAI from "openai";
import { defaultRateLimiter } from "./rate-limiter";
import { CHAT_TIMEOUT_MS, makeAbortSignal, STREAM_TIMEOUT_MS } from "./timeout";
import type { ChatRequest, ChatResponse, LLMProvider, StreamChunk } from "./types";

export class OpenAIProvider implements LLMProvider {
  readonly name = "openai";
  private client: OpenAI;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set — add it to .env.local");
    }
    this.client = new OpenAI({ apiKey });
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const start = Date.now();
    const timeoutMs = req.timeoutMs ?? CHAT_TIMEOUT_MS;
    const signal = makeAbortSignal(timeoutMs, req.signal);

    // Backoff proactif : si on connaît un budget bas / retry-after, on attend.
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
      cost_usd: 0,
      latency_ms: Date.now() - start,
    };
  }

  async *streamChat(req: ChatRequest): AsyncGenerator<StreamChunk> {
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
        },
        { signal },
      )
      .withResponse();

    this.recordRateLimitHeaders(response);

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? "";
      const done = chunk.choices[0]?.finish_reason !== null;
      if (delta || done) {
        yield { delta, done };
      }
    }
  }

  /**
   * Enregistre les headers `x-ratelimit-*` / `retry-after` pour le backoff
   * proactif. Tolérant : un échec de parsing ne casse pas l'appel utilisateur.
   */
  private recordRateLimitHeaders(response: Response | undefined): void {
    try {
      if (response?.headers) {
        defaultRateLimiter.recordHeaders("openai", response.headers);
      }
    } catch (err) {
      console.warn("[OpenAI] recordHeaders failed:", err);
    }
  }

  /**
   * Attend si le rate-limiter recommande un délai. Ne bloque jamais en cas
   * d'erreur.
   */
  private async maybeWaitForRateLimit(): Promise<void> {
    try {
      const delay = defaultRateLimiter.getNextDelay("openai");
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    } catch {
      // best-effort
    }
  }
}
