// src/handler/createCockpitChatHandler.ts
import { z } from "zod";
var BodySchema = z.object({
  chatId: z.string().nullish(),
  message: z.string().min(1, "Message vide"),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.string()
    })
  ).optional(),
  productId: z.string().nullish(),
  system: z.string().optional()
});
var memStore = /* @__PURE__ */ new Map();
function checkRateLimit(ip, max, windowMs) {
  if (memStore.size > 500) {
    const now2 = Date.now();
    for (const [key, entry] of memStore) {
      if (now2 > entry.resetAt) memStore.delete(key);
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
    return { limited: true, retryAfter: Math.ceil((slot.resetAt - now) / 1e3) };
  }
  return { limited: false, retryAfter: 0 };
}
function generateId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}
function makeThinkStripper() {
  let buffer = "";
  let inThink = false;
  return function feed(chunk) {
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
          for (let prefLen = Math.min(OPEN_TAG.length - 1, tail.length); prefLen > 0; prefLen--) {
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
function createCockpitChatHandler(config) {
  const {
    llmClient,
    model,
    systemPrompt,
    persistence,
    rateLimitMax = 20,
    rateLimitWindowMs = 6e4,
    userId
  } = config;
  async function POST(req) {
    const rateLimitKey = userId ?? req.headers.get("x-vercel-forwarded-for") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "unknown";
    const { limited, retryAfter } = checkRateLimit(
      rateLimitKey,
      rateLimitMax,
      rateLimitWindowMs
    );
    if (limited) {
      return new Response("Trop de requ\xEAtes \u2014 r\xE9essaie dans quelques instants.", {
        status: 429,
        headers: { "Retry-After": String(retryAfter) }
      });
    }
    let raw;
    try {
      raw = await req.json();
    } catch {
      return new Response("Bad request", { status: 400 });
    }
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.issues[0]?.message ?? "Bad request" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    const body = parsed.data;
    const message = body.message.trim();
    if (!message) return new Response("Empty message", { status: 400 });
    let chatId = body.chatId ?? null;
    const history = [];
    if (persistence) {
      try {
        if (!chatId) {
          chatId = await persistence.createChat();
        } else {
          const loaded = await persistence.loadMessages(chatId);
          history.push(
            ...loaded.map((m) => ({
              role: m.role,
              content: m.content
            }))
          );
        }
        if (chatId) {
          const userMsg = {
            id: generateId(),
            role: "user",
            content: message,
            createdAt: Date.now()
          };
          await persistence.saveMessage(chatId, userMsg);
        }
      } catch {
        if (body.messages?.length) {
          history.push(...body.messages);
        }
      }
    } else if (body.messages?.length) {
      history.push(...body.messages);
    }
    history.push({ role: "user", content: message });
    const messages = [];
    const rawSystem = body.system ?? systemPrompt;
    const effectiveSystem = typeof rawSystem === "function" ? rawSystem(body.productId ?? "hub") : rawSystem;
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
          messages
        },
        { signal: reqSignal }
      );
    } catch {
      return new Response("LLM upstream error", { status: 502 });
    }
    const stripThink = makeThinkStripper();
    let full = "";
    const stream = new ReadableStream({
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
          const tail = stripThink("");
          if (tail) {
            full += tail;
            controller.enqueue(enc.encode(tail));
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : "LLM error";
          controller.enqueue(enc.encode(`\0ERROR:${errMsg}`));
        } finally {
          controller.close();
          if (persistence && chatId && full) {
            try {
              const assistantMsg = {
                id: generateId(),
                role: "assistant",
                content: full,
                createdAt: Date.now()
              };
              await persistence.saveMessage(chatId, assistantMsg);
            } catch {
            }
          }
        }
      },
      cancel() {
      }
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        ...chatId ? { "x-chat-id": chatId } : {}
      }
    });
  }
  return { POST };
}
export {
  createCockpitChatHandler,
  makeThinkStripper
};
