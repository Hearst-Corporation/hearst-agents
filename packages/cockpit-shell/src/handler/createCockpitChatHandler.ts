/**
 * createCockpitChatHandler.ts
 * ─────────────────────────────────────────────────────────────────────────
 * Factory : retourne `{ POST }` à exporter depuis une route Next.js
 * (`app/api/cockpit-chat/route.ts`). Chaque app la consomme avec son propre
 * client LLM (OpenAI / Hypercli compatible) + son systemPrompt + sa
 * persistance optionnelle.
 *
 * Inclus :
 *   - validation Zod du body
 *   - rate-limit in-memory (clé IP, fallback si pas d'Upstash configuré
 *     par l'app — celle-ci peut wrapper le handler si elle veut du distribué)
 *   - filtrage stream-safe des blocs `<think>...</think>`
 *   - header `x-chat-id` renvoyé au client
 */

// On utilise Request natif (Web API) plutôt que NextRequest pour rester
// compatible avec Next.js 14, 15 et 16 sans conflit de types.
import { z } from "zod";
import type { ChatMessage, ChatPersistence } from "../chat/types";

// Interface structurelle minimale — évite tout conflit de version openai entre apps.
interface LLMStreamChunk {
  choices?: Array<{ delta?: { content?: string | null } }>;
}
interface LLMClient {
  chat: {
    completions: {
      create(
        params: {
          model: string;
          stream: true;
          messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
        },
        options?: { signal?: AbortSignal },
      ): Promise<AsyncIterable<LLMStreamChunk>>;
    };
  };
}

export interface CockpitChatHandlerConfig {
  /** Client OpenAI-compatible (Hypercli Kimi 2.6 le plus souvent). */
  llmClient: LLMClient;
  /** Modèle LLM. */
  model: string;
  /**
   * System prompt par défaut (peut être surchargé par requête via `body.system`).
   * Accepte une string statique ou une fonction `(productId: string) => string`
   * pour adapter le prompt au produit actif.
   */
  systemPrompt?: string | ((productId: string) => string);
  /** Persistance optionnelle des messages (Supabase RLS le plus souvent). */
  persistence?: ChatPersistence;
  /** Rate-limit : nombre de requêtes par fenêtre. Défaut : 20. */
  rateLimitMax?: number;
  /** Rate-limit : taille de la fenêtre en ms. Défaut : 60_000. */
  rateLimitWindowMs?: number;
  /**
   * Identifiant utilisateur authentifié. Si fourni, utilisé comme clé du
   * rate-limit au lieu de l'IP (évite les faux positifs en NAT entreprise).
   */
  userId?: string;
}

const BodySchema = z.object({
  chatId: z.string().nullish(),
  message: z.string().min(1, "Message vide"),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string(),
      }),
    )
    .optional(),
  productId: z.string().nullish(),
  system: z.string().optional(),
});

/** Fallback in-memory : process isolé, non persisté. */
const memStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(
  ip: string,
  max: number,
  windowMs: number,
): { limited: boolean; retryAfter: number } {
  if (memStore.size > 500) {
    const now = Date.now();
    for (const [key, entry] of memStore) {
      if (now > entry.resetAt) memStore.delete(key);
    }
  }
  const now = Date.now();
  const slot = memStore.get(ip);
  if (!slot || now > slot.resetAt) {
    memStore.set(ip, { count: 1, resetAt: now + windowMs });
    return { limited: false, retryAfter: 0 };
  }
  slot.count += 1;
  if (slot.count > max) {
    return { limited: true, retryAfter: Math.ceil((slot.resetAt - now) / 1000) };
  }
  return { limited: false, retryAfter: 0 };
}

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Filtre stream-safe des `<think>...</think>` (raisonnement Kimi privé).
 * Exporté pour les tests unitaires.
 */
export function makeThinkStripper() {
  let buffer = "";
  let inThink = false;

  return function feed(chunk: string): string {
    buffer += chunk;
    let output = "";
    let i = 0;
    while (i < buffer.length) {
      if (!inThink) {
        const openIdx = buffer.indexOf("<think>", i);
        if (openIdx === -1) {
          const tail = buffer.slice(i);
          const OPEN_TAG = "<think>";
          let holdLen = 0;
          for (
            let prefLen = Math.min(OPEN_TAG.length - 1, tail.length);
            prefLen > 0;
            prefLen--
          ) {
            if (tail.endsWith(OPEN_TAG.slice(0, prefLen))) {
              holdLen = prefLen;
              break;
            }
          }
          output += tail.slice(0, tail.length - holdLen);
          buffer = holdLen > 0 ? tail.slice(tail.length - holdLen) : "";
          return output;
        }
        output += buffer.slice(i, openIdx);
        inThink = true;
        i = openIdx + 7;
      } else {
        const closeIdx = buffer.indexOf("</think>", i);
        if (closeIdx === -1) {
          buffer = buffer.slice(i);
          return output;
        }
        inThink = false;
        i = closeIdx + 8;
      }
    }
    buffer = "";
    return output;
  };
}

export function createCockpitChatHandler(config: CockpitChatHandlerConfig) {
  const {
    llmClient,
    model,
    systemPrompt,
    persistence,
    rateLimitMax = 20,
    rateLimitWindowMs = 60_000,
    userId,
  } = config;

  async function POST(req: Request): Promise<Response> {
    // Rate-limit : userId si authentifié (évite les faux positifs en NAT entreprise),
    // sinon x-vercel-forwarded-for (signé par Vercel edge, non-spoofable),
    // puis x-forwarded-for en fallback (spoofable hors Vercel).
    const rateLimitKey =
      userId ??
      req.headers.get("x-vercel-forwarded-for") ??
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";
    const { limited, retryAfter } = checkRateLimit(
      rateLimitKey,
      rateLimitMax,
      rateLimitWindowMs,
    );
    if (limited) {
      return new Response("Trop de requêtes — réessaie dans quelques instants.", {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      });
    }

    // Parse + valide body.
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return new Response("Bad request", { status: 400 });
    }
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.issues[0]?.message ?? "Bad request" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    const body = parsed.data;
    const message = body.message.trim();
    if (!message) return new Response("Empty message", { status: 400 });

    // Construit l'historique : si persistance et chatId → DB ; sinon body.messages.
    let chatId: string | null = body.chatId ?? null;
    const history: { role: "user" | "assistant" | "system"; content: string }[] = [];

    if (persistence) {
      try {
        if (!chatId) {
          chatId = await persistence.createChat();
        } else {
          const loaded = await persistence.loadMessages(chatId);
          history.push(
            ...loaded.map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
          );
        }
        if (chatId) {
          const userMsg: ChatMessage = {
            id: generateId(),
            role: "user",
            content: message,
            createdAt: Date.now(),
          };
          await persistence.saveMessage(chatId, userMsg);
        }
      } catch {
        // Persistance KO → fallback sur l'historique envoyé par le client.
        if (body.messages?.length) {
          history.push(...body.messages);
        }
      }
    } else if (body.messages?.length) {
      history.push(...body.messages);
    }
    history.push({ role: "user", content: message });

    const messages: { role: "user" | "assistant" | "system"; content: string }[] = [];
    const rawSystem = body.system ?? systemPrompt;
    const effectiveSystem =
      typeof rawSystem === "function"
        ? rawSystem(body.productId ?? "hub")
        : rawSystem;
    if (effectiveSystem) {
      messages.push({ role: "system", content: effectiveSystem });
    }
    messages.push(...history);

    const reqSignal = req.signal;

    let completion;
    try {
      completion = await llmClient.chat.completions.create(
        {
          model,
          stream: true,
          messages,
        },
        { signal: reqSignal },
      );
    } catch {
      return new Response("LLM upstream error", { status: 502 });
    }

    const stripThink = makeThinkStripper();
    let full = "";

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const enc = new TextEncoder();
        try {
          for await (const part of completion) {
            if (reqSignal.aborted) break;
            const delta = part.choices?.[0]?.delta?.content ?? "";
            if (!delta) continue;
            const filtered = stripThink(delta);
            if (filtered) {
              full += filtered;
              controller.enqueue(enc.encode(filtered));
            }
          }
          // Flush final.
          const tail = stripThink("");
          if (tail) {
            full += tail;
            controller.enqueue(enc.encode(tail));
          }
        } catch (err) {
          // Signal d'erreur lisible par le client via \x00ERROR:.
          const errMsg = err instanceof Error ? err.message : "LLM error";
          controller.enqueue(enc.encode(`\x00ERROR:${errMsg}`));
        } finally {
          controller.close();
          if (persistence && chatId && full) {
            try {
              const assistantMsg: ChatMessage = {
                id: generateId(),
                role: "assistant",
                content: full,
                createdAt: Date.now(),
              };
              await persistence.saveMessage(chatId, assistantMsg);
            } catch {
              /* best-effort */
            }
          }
        }
      },
      cancel() {
        /* reqSignal.aborted gérera l'arrêt côté for-await */
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        ...(chatId ? { "x-chat-id": chatId } : {}),
      },
    });
  }

  return { POST };
}
