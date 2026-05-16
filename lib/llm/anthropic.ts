/**
 * @deprecated Ce provider Anthropic est obsolète. L'application utilise
 * maintenant Kimi (Moonshot AI) via le SDK OpenAI-compatible.
 * Voir : lib/engine/orchestrator/ai-pipeline.ts, lib/engine/orchestrator/planner.ts
 * Ce fichier est conservé temporairement pour référence mais ne doit plus être utilisé.
 */
import Anthropic from "@anthropic-ai/sdk";
import { startTrace } from "@/lib/observability/langfuse";
import { redactForLangfuse } from "@/lib/observability/langfuse-redact";
import { logger } from "@/lib/observability/logger";
import { computeCostUsd } from "./pricing";
import { defaultRateLimiter } from "./rate-limiter";
import { CHAT_TIMEOUT_MS, makeAbortSignal, STREAM_TIMEOUT_MS } from "./timeout";
import type { ChatMessage, ChatRequest, ChatResponse, LLMProvider, StreamChunk } from "./types";

/**
 * Headers rate-limit exposés par Anthropic sur chaque réponse HTTP.
 * Voir https://docs.anthropic.com/en/api/rate-limits#response-headers
 */
const ANTHROPIC_RATE_LIMIT_HEADERS = [
  "anthropic-ratelimit-requests-limit",
  "anthropic-ratelimit-requests-remaining",
  "anthropic-ratelimit-requests-reset",
  "anthropic-ratelimit-tokens-limit",
  "anthropic-ratelimit-tokens-remaining",
  "anthropic-ratelimit-tokens-reset",
  "retry-after",
] as const;

function recordAnthropicRateHeaders(response: Response | undefined): void {
  if (!response?.headers) return;
  const headers: Record<string, string> = {};
  for (const key of ANTHROPIC_RATE_LIMIT_HEADERS) {
    const value = response.headers.get(key);
    if (value) headers[key] = value;
  }
  try {
    if (Object.keys(headers).length > 0) {
      defaultRateLimiter.recordHeaders("anthropic", headers);
    }
  } catch (err) {
    logger.warn({ err }, "[anthropic] recordHeaders failed");
  }
}

export interface ToolUseRequest {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolChatResult {
  text: string;
  toolCalls: ToolUseRequest[];
  stopReason: string;
  tokensIn: number;
  tokensOut: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  rawResponse: Anthropic.Message;
}

export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic";
  private client: Anthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not set — add it to .env.local");
    }
    this.client = new Anthropic({ apiKey });
  }

  /**
   * Single-turn chat with optional tool definitions.
   * Returns tool_use blocks if the model wants to call tools.
   */
  async chatWithTools(req: ChatRequest, tools?: Anthropic.Tool[]): Promise<ToolChatResult> {
    const systemMsg = req.messages.find((m) => m.role === "system");
    const userMessages = this.buildMessages(req);

    const params = this.buildParams(req, systemMsg, userMessages);

    if (tools && tools.length > 0) {
      params.tools = tools;
    }

    const trace = startTrace("anthropic.chatWithTools", {
      model: req.model,
      hasTools: Boolean(tools?.length),
    });
    const generation = trace?.generation({
      name: "anthropic.messages.create",
      model: req.model,
      modelParameters: {
        max_tokens: params.max_tokens,
        temperature: params.temperature ?? null,
        top_p: params.top_p ?? null,
      },
      input: redactForLangfuse({ system: params.system, messages: params.messages }),
    });

    const timeoutMs = req.timeoutMs ?? CHAT_TIMEOUT_MS;
    const signal = makeAbortSignal(timeoutMs, req.signal);
    let res: Anthropic.Message;
    try {
      // `withResponse()` expose la `Response` Fetch brute pour parser les headers
      // rate-limit Anthropic — on conserve la même `data` qu'avant.
      const { data, response } = await this.client.messages
        .create({ ...params, stream: false }, { signal })
        .withResponse();
      res = data;
      recordAnthropicRateHeaders(response);
    } catch (err) {
      generation?.end({
        level: "ERROR",
        statusMessage: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }

    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const toolCalls = res.content
      .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
      .map((b) => ({ id: b.id, name: b.name, input: b.input as Record<string, unknown> }));

    generation?.end({
      output: { text, toolCalls },
      usage: {
        input: res.usage.input_tokens,
        output: res.usage.output_tokens,
        unit: "TOKENS",
        totalCost: computeCostUsd("anthropic", req.model, {
          input_tokens: res.usage.input_tokens,
          output_tokens: res.usage.output_tokens,
          cache_read_input_tokens: res.usage.cache_read_input_tokens ?? 0,
        }),
      },
    });

    return {
      text,
      toolCalls,
      stopReason: res.stop_reason ?? "end_turn",
      tokensIn: res.usage.input_tokens,
      tokensOut: res.usage.output_tokens,
      cacheCreationTokens: res.usage.cache_creation_input_tokens ?? 0,
      cacheReadTokens: res.usage.cache_read_input_tokens ?? 0,
      rawResponse: res,
    };
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const start = Date.now();
    const result = await this.chatWithTools(req);

    const cacheInfo = {
      ...(result.cacheCreationTokens ? { cache_creation_tokens: result.cacheCreationTokens } : {}),
      ...(result.cacheReadTokens ? { cache_read_tokens: result.cacheReadTokens } : {}),
    };

    // Log cache metrics for observability
    if (result.cacheReadTokens > 0 || result.cacheCreationTokens > 0) {
      logger.debug(
        {
          cache_read: result.cacheReadTokens,
          cache_created: result.cacheCreationTokens,
          model: req.model,
        },
        "[anthropic] cache metrics",
      );
    }

    return {
      content: result.text,
      model: req.model,
      provider: this.name,
      tokens_in: result.tokensIn,
      tokens_out: result.tokensOut,
      cost_usd: computeCostUsd("anthropic", req.model, {
        input_tokens: result.tokensIn,
        output_tokens: result.tokensOut,
        cache_read_input_tokens: result.cacheReadTokens ?? 0,
      }),
      latency_ms: Date.now() - start,
      ...cacheInfo,
    };
  }

  async *streamChat(req: ChatRequest, tools?: Anthropic.Tool[]): AsyncGenerator<StreamChunk> {
    const systemMsg = req.messages.find((m) => m.role === "system");
    const userMessages = this.buildMessages(req);

    const params = this.buildParams(req, systemMsg, userMessages);

    if (tools && tools.length > 0) {
      params.tools = tools;
    }

    const trace = startTrace("anthropic.streamChat", {
      model: req.model,
      hasTools: Boolean(tools?.length),
    });
    const generation = trace?.generation({
      name: "anthropic.messages.stream",
      model: req.model,
      modelParameters: {
        max_tokens: params.max_tokens,
        temperature: params.temperature ?? null,
        top_p: params.top_p ?? null,
      },
      input: redactForLangfuse({ system: params.system, messages: params.messages }),
    });

    const timeoutMs = req.timeoutMs ?? STREAM_TIMEOUT_MS;
    const signal = makeAbortSignal(timeoutMs, req.signal);
    const stream = this.client.messages.stream(params as Anthropic.MessageStreamParams, { signal });

    let collectedText = "";
    let streamStopped = false;
    try {
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          collectedText += event.delta.text;
          yield { delta: event.delta.text, done: false };
        }
        if (event.type === "message_stop") {
          streamStopped = true;
        }
      }

      // Stream consumed — récupère les headers (rate-limit) et l'usage final.
      recordAnthropicRateHeaders(stream.response ?? undefined);

      // Récupère usage final pour calculer cost_usd réel avant de yielder done.
      let finalCostUsd = 0;
      let finalTokensIn = 0;
      let finalTokensOut = 0;
      let finalCacheRead = 0;
      let finalCacheCreation = 0;
      try {
        const final = await stream.finalMessage();
        finalTokensIn = final.usage.input_tokens;
        finalTokensOut = final.usage.output_tokens;
        finalCacheRead = final.usage.cache_read_input_tokens ?? 0;
        finalCacheCreation = final.usage.cache_creation_input_tokens ?? 0;
        finalCostUsd = computeCostUsd("anthropic", req.model, {
          input_tokens: finalTokensIn,
          output_tokens: finalTokensOut,
          cache_read_input_tokens: finalCacheRead,
        });
        generation?.end({
          output: { text: collectedText },
          usage: {
            input: finalTokensIn,
            output: finalTokensOut,
            unit: "TOKENS",
            totalCost: finalCostUsd,
          },
        });
      } catch {
        // finalMessage() peut throw si le stream a été interrompu — on ferme la
        // génération avec ce qu'on a sans casser le caller.
        generation?.end({ output: { text: collectedText } });
      }

      // Yield le chunk final avec usage uniquement si message_stop a été reçu.
      if (streamStopped) {
        yield {
          delta: "",
          done: true,
          cost_usd: finalCostUsd,
          tokens_in: finalTokensIn,
          tokens_out: finalTokensOut,
          cache_read_tokens: finalCacheRead,
          cache_creation_tokens: finalCacheCreation,
        };
      }
    } catch (err) {
      generation?.end({
        level: "ERROR",
        statusMessage: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  private buildParams(
    req: ChatRequest,
    systemMsg: ChatMessage | undefined,
    messages: Anthropic.MessageParam[],
  ): Anthropic.MessageCreateParams {
    const params: Anthropic.MessageCreateParams = {
      model: req.model,
      max_tokens: req.max_tokens ?? 4096,
      system: this.buildSystem(systemMsg),
      messages,
    };
    // Anthropic newer models reject temperature + top_p together
    if (req.temperature != null) {
      params.temperature = req.temperature;
    } else if (req.top_p != null) {
      params.top_p = req.top_p;
    }
    return params;
  }

  /**
   * If the system message carries a cache_control hint, send it as a single
   * cacheable text content block. Otherwise pass the raw string for the
   * smallest possible request payload.
   *
   * Auto-apply cache_control for system prompts > 1024 tokens (Anthropic
   * minimum) to optimize repeated calls. The ephemeral 5-min TTL is perfect
   * for chat sessions where the system context is stable.
   */
  private buildSystem(systemMsg: ChatMessage | undefined): Anthropic.MessageCreateParams["system"] {
    if (!systemMsg) return undefined;

    // If explicitly set, respect it
    if (systemMsg.cache_control) {
      return [
        {
          type: "text",
          text: systemMsg.content,
          cache_control: systemMsg.cache_control,
        },
      ];
    }

    // Auto-cache system prompts that are reasonably large (>500 chars ≈ ~125 tokens)
    // Anthropic requires min 1024 tokens for cache hit, but we can start caching
    // earlier to warm up. The system prompt is typically static across turns.
    if (systemMsg.content.length > 500) {
      return [
        {
          type: "text",
          text: systemMsg.content,
          cache_control: { type: "ephemeral" },
        },
      ];
    }

    return systemMsg.content;
  }

  private buildMessages(req: ChatRequest): Anthropic.MessageParam[] {
    return req.messages
      .filter((m) => m.role !== "system")
      .map((m) => {
        if (m.cache_control) {
          return {
            role: m.role as "user" | "assistant",
            content: [
              {
                type: "text" as const,
                text: m.content,
                cache_control: m.cache_control,
              },
            ],
          };
        }
        return {
          role: m.role as "user" | "assistant",
          content: m.content,
        };
      });
  }
}
