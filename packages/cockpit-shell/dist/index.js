"use client";

// src/shell/CockpitShell.tsx
import { useEffect as useEffect7, useMemo, useState as useState7, useSyncExternalStore as useSyncExternalStore7 } from "react";

// src/stores/activeProductStore.ts
var LS_KEY = "cockpit:active-product";
var listeners = /* @__PURE__ */ new Set();
var DEFAULT_ID = "hub";
function setDefaultActive(id) {
  DEFAULT_ID = id;
}
function getSnapshot() {
  if (typeof window === "undefined") return DEFAULT_ID;
  const s = window.localStorage.getItem(LS_KEY);
  return s || DEFAULT_ID;
}
function getServerSnapshot() {
  return DEFAULT_ID;
}
function subscribe(cb) {
  listeners.add(cb);
  const onStorage = (e) => {
    if (e.key === LS_KEY) cb();
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    listeners.delete(cb);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}
function notifyAll() {
  listeners.forEach((cb) => cb());
}
function setActive(id) {
  if (getSnapshot() === id) return;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LS_KEY, id);
  }
  notifyAll();
}

// src/shell/context.tsx
import { createContext, useContext } from "react";
var HUB_FALLBACK = {
  id: "hub",
  name: "Hearst Corporation",
  short: "HC",
  color: "#8A1538"
};
var CockpitContext = createContext({
  products: [HUB_FALLBACK],
  appId: "hub",
  chatConfig: {},
  getProduct: () => HUB_FALLBACK
});
function useCockpit() {
  return useContext(CockpitContext);
}

// src/shell/RailLeft.tsx
import { useSyncExternalStore, useEffect, useRef, useState } from "react";

// src/stores/launcherStore.ts
var LS_KEY2 = "cockpit:launcher-open";
var listeners2 = /* @__PURE__ */ new Set();
function getSnapshot2() {
  if (typeof window === "undefined") return true;
  const s = window.localStorage.getItem(LS_KEY2);
  return s === null ? true : s === "1";
}
function getServerSnapshot2() {
  return true;
}
function subscribe2(cb) {
  listeners2.add(cb);
  const onStorage = (e) => {
    if (e.key === LS_KEY2) cb();
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    listeners2.delete(cb);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}
function set(open) {
  if (getSnapshot2() === open) return;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LS_KEY2, open ? "1" : "0");
  }
  listeners2.forEach((cb) => cb());
}

// src/shell/HearstMark.tsx
import { jsx, jsxs } from "react/jsx-runtime";
function HearstMark({ size = 22 }) {
  return /* @__PURE__ */ jsxs(
    "svg",
    {
      height: size,
      width: Math.round(size * 155 / 170),
      viewBox: "560 455 155 170",
      fill: "currentColor",
      "aria-hidden": "true",
      style: { display: "block" },
      children: [
        /* @__PURE__ */ jsx("polygon", { points: "601.74 466.87 572.6 466.87 572.6 609.73 601.74 609.73 601.74 549.07 633.11 579.43 665.76 579.43 601.74 517.46 601.74 466.87" }),
        /* @__PURE__ */ jsx("polygon", { points: "672.72 466.87 672.72 528.12 644.63 500.93 611.98 500.93 672.72 559.72 672.72 609.73 701.86 609.73 701.86 466.87 672.72 466.87" })
      ]
    }
  );
}

// src/shell/RailLeft.tsx
import { jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
function RailLeft() {
  const { products, appId, getProduct } = useCockpit();
  const active = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const open = useSyncExternalStore(subscribe2, getSnapshot2, getServerSnapshot2);
  const otherProducts = products.filter((p) => p.id !== appId);
  const current2 = getProduct(active);
  const inProduct = current2.id !== appId;
  const label = (name) => name.replace(/^Hearst\s+/, "");
  const top = inProduct && !open ? current2 : getProduct(appId);
  function pick(id) {
    setActive(id);
    set(false);
  }
  return /* @__PURE__ */ jsxs2("aside", { className: `ct-rail-left${open ? " launcher" : ""}`, children: [
    /* @__PURE__ */ jsxs2(
      "button",
      {
        type: "button",
        className: "ct-rail-top",
        title: open ? "R\xE9duire" : `${top.name} \u2014 ouvrir le lanceur`,
        "aria-label": open ? "R\xE9duire le lanceur" : "Ouvrir le lanceur",
        onClick: () => {
          if (inProduct && !open) {
            setActive(appId);
          } else {
            set(!open);
          }
        },
        style: { ["--p-color"]: top.color },
        children: [
          /* @__PURE__ */ jsx2("span", { className: "ct-rail-top-badge", children: /* @__PURE__ */ jsx2(HearstMark, { size: 26 }) }),
          /* @__PURE__ */ jsx2("span", { className: "ct-rail-top-name", children: label(top.name) })
        ]
      }
    ),
    open ? /* @__PURE__ */ jsx2("nav", { className: "ct-rail-list", "aria-label": "Produits Hearst", children: otherProducts.map((p) => {
      const on = active === p.id;
      return /* @__PURE__ */ jsxs2(
        "button",
        {
          type: "button",
          className: `ct-rail-row${on ? " active" : ""}`,
          title: p.name,
          "aria-pressed": on,
          onClick: () => pick(p.id),
          style: { ["--p-color"]: p.color },
          children: [
            /* @__PURE__ */ jsx2("span", { className: "ct-rail-row-icon", children: /* @__PURE__ */ jsx2(HearstMark, { size: 24 }) }),
            /* @__PURE__ */ jsx2("span", { className: "ct-rail-row-name", children: label(p.name) })
          ]
        },
        p.id
      );
    }) }) : /* @__PURE__ */ jsx2("div", { className: "ct-spacer" }),
    /* @__PURE__ */ jsx2("div", { className: "ct-spacer" }),
    /* @__PURE__ */ jsx2(UserBadge, { appId })
  ] });
}
function UserBadge({ appId }) {
  const [initials, setInitials] = useState("");
  const [armed, setArmed] = useState(false);
  const armRef = useRef(null);
  const timerRef = useRef(null);
  useEffect(() => {
    (async () => {
      try {
        const moduleName = "@supabase/ssr";
        const mod = await Function("m", "return import(m)")(moduleName).catch(() => null);
        if (!mod?.createBrowserClient) return;
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!url || !key) return;
        const sb = mod.createBrowserClient(url, key);
        const { data: { user } } = await sb.auth.getUser();
        if (user?.email) setInitials(computeInitials(user.email));
      } catch {
      }
    })();
  }, []);
  useEffect(() => {
    if (!armed) return;
    timerRef.current = window.setTimeout(() => setArmed(false), 5e3);
    const onDocClick = (e) => {
      if (armRef.current && !armRef.current.contains(e.target)) {
        setArmed(false);
      }
    };
    document.addEventListener("click", onDocClick);
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      document.removeEventListener("click", onDocClick);
    };
  }, [armed]);
  async function handleClick(e) {
    e.stopPropagation();
    if (armed) {
      try {
        const moduleName = "@supabase/ssr";
        const mod = await Function("m", "return import(m)")(moduleName).catch(() => null);
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (mod?.createBrowserClient && url && key) {
          const sb = mod.createBrowserClient(url, key);
          await sb.auth.signOut();
        }
      } catch {
      }
      window.location.href = "/login";
      return;
    }
    setArmed(true);
    if (window.location.pathname !== "/profile") {
      window.location.href = "/profile";
    }
  }
  const display = initials || (appId || "HC").slice(0, 2).toUpperCase();
  return /* @__PURE__ */ jsx2(
    "button",
    {
      ref: armRef,
      type: "button",
      className: `ct-avatar${armed ? " active" : ""}`,
      title: armed ? "Cliquer pour se d\xE9connecter" : "Profil & r\xE9glages",
      onClick: handleClick,
      children: armed ? /* @__PURE__ */ jsx2(LogoutIcon, {}) : display
    }
  );
}
function LogoutIcon() {
  return /* @__PURE__ */ jsxs2(
    "svg",
    {
      width: "18",
      height: "18",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      children: [
        /* @__PURE__ */ jsx2("path", { d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" }),
        /* @__PURE__ */ jsx2("polyline", { points: "16 17 21 12 16 7" }),
        /* @__PURE__ */ jsx2("line", { x1: "21", y1: "12", x2: "9", y2: "12" })
      ]
    }
  );
}
function computeInitials(email) {
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._-]/).filter(Boolean);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}

// src/shell/CenterPanel.tsx
import { useSyncExternalStore as useSyncExternalStore2 } from "react";
import { jsx as jsx3 } from "react/jsx-runtime";
function CenterPanel({ children, renderProduct }) {
  const active = useSyncExternalStore2(subscribe, getSnapshot, getServerSnapshot);
  const { appId } = useCockpit();
  const showProduct = renderProduct && active !== appId;
  return /* @__PURE__ */ jsx3("div", { className: "ct-center-panel", children: showProduct ? renderProduct(active) : /* @__PURE__ */ jsx3("div", { className: "ct-page-area", children }) });
}

// src/shell/RailRight.tsx
import { useSyncExternalStore as useSyncExternalStore4 } from "react";

// src/stores/railOpenStore.ts
var LS_KEY3 = "cockpit:rail-right-open";
var listeners3 = /* @__PURE__ */ new Set();
function getSnapshot3() {
  if (typeof window === "undefined") return true;
  const s = window.localStorage.getItem(LS_KEY3);
  return s === null ? true : s === "1";
}
function getServerSnapshot3() {
  return true;
}
function subscribe3(cb) {
  listeners3.add(cb);
  const onStorage = (e) => {
    if (e.key === LS_KEY3) cb();
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    listeners3.delete(cb);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}
function notifyAll2() {
  listeners3.forEach((cb) => cb());
}
function toggle() {
  const next = !getSnapshot3();
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LS_KEY3, next ? "1" : "0");
  }
  notifyAll2();
}
function forceOpen() {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LS_KEY3, "1");
  }
  notifyAll2();
}

// src/stores/chatViewStore.ts
var LS_KEY4 = "cockpit:chat-view";
var ALLOWED = ["chat", "settings", "history"];
var listeners4 = /* @__PURE__ */ new Set();
function getSnapshot4() {
  if (typeof window === "undefined") return "chat";
  const s = window.localStorage.getItem(LS_KEY4);
  return ALLOWED.includes(s) ? s : "chat";
}
function getServerSnapshot4() {
  return "chat";
}
function subscribe4(cb) {
  listeners4.add(cb);
  return () => {
    listeners4.delete(cb);
  };
}
function notifyAll3() {
  listeners4.forEach((cb) => cb());
}
function setView(v) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LS_KEY4, v);
  }
  notifyAll3();
}

// src/chat/ChatKimi.tsx
import {
  useCallback as useCallback2,
  useEffect as useEffect3,
  useRef as useRef3,
  useState as useState3,
  useSyncExternalStore as useSyncExternalStore3
} from "react";
import DOMPurify from "dompurify";

// src/stores/activeChatStore.ts
var listeners5 = /* @__PURE__ */ new Set();
var current = null;
function getSnapshot5() {
  return current;
}
function getServerSnapshot5() {
  return null;
}
function subscribe5(cb) {
  listeners5.add(cb);
  return () => {
    listeners5.delete(cb);
  };
}
function setActiveChat(id) {
  current = id;
  listeners5.forEach((cb) => cb());
}

// src/chat/useChat.ts
import { useCallback, useEffect as useEffect2, useRef as useRef2, useState as useState2 } from "react";
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
          i = buffer.length;
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
var WELCOME_MSG = {
  id: "welcome",
  role: "assistant",
  content: "Bonjour ! Je suis Kimi K2.6, votre assistant Hearst. Comment puis-je vous aider aujourd'hui ?",
  createdAt: 0
};
function useChat(opts) {
  const {
    apiEndpoint = "/api/cockpit-chat",
    chatId: initialChatId = null,
    onChatId,
    persistence,
    productId = null
  } = opts ?? {};
  const [messages, setMessages] = useState2([]);
  const [streaming, setStreaming] = useState2(false);
  const [error, setError] = useState2(null);
  const [chatId, setChatId] = useState2(initialChatId ?? null);
  const abortRef = useRef2(null);
  const pendingRef = useRef2(false);
  const mountedRef = useRef2(true);
  const messagesRef = useRef2(messages);
  messagesRef.current = messages;
  useEffect2(() => {
    setChatId(initialChatId ?? null);
  }, [initialChatId]);
  useEffect2(() => {
    let cancelled = false;
    if (!chatId) {
      setMessages([WELCOME_MSG]);
      return;
    }
    if (persistence) {
      persistence.loadMessages(chatId).then((loaded) => {
        if (!cancelled) setMessages(loaded.length > 0 ? loaded : [WELCOME_MSG]);
      }).catch(() => {
        if (!cancelled) setMessages([WELCOME_MSG]);
      });
    } else {
      fetch(`/api/cockpit-chats/${chatId}`, { cache: "no-store" }).then((r) => r.ok ? r.json() : Promise.reject()).then((data) => {
        if (cancelled) return;
        const loaded = (data.messages ?? []).map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: new Date(m.created_at).getTime()
        }));
        setMessages(loaded.length > 0 ? loaded : [WELCOME_MSG]);
      }).catch(() => {
        if (!cancelled) setMessages([WELCOME_MSG]);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [chatId, persistence]);
  useEffect2(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);
  const reset = useCallback(() => {
    abortRef.current?.abort();
    pendingRef.current = false;
    setMessages([WELCOME_MSG]);
    setError(null);
    setStreaming(false);
    setChatId(null);
  }, []);
  const sendMessage = useCallback(
    async (text) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (pendingRef.current) return;
      pendingRef.current = true;
      abortRef.current?.abort();
      setError(null);
      const userMsg = {
        id: generateId(),
        role: "user",
        content: trimmed,
        createdAt: Date.now()
      };
      const history = messagesRef.current.map((m) => ({
        role: m.role,
        content: m.content
      }));
      setMessages((prev) => [...prev, userMsg]);
      const assistantId = generateId();
      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: "assistant",
          content: "",
          createdAt: Date.now()
        }
      ]);
      setStreaming(true);
      const controller = new AbortController();
      abortRef.current = controller;
      const stripThink = makeThinkStripper();
      const modelOverride = typeof window !== "undefined" ? window.localStorage.getItem("cockpit:chat-model") ?? void 0 : void 0;
      try {
        const resp = await fetch(apiEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chatId: chatId ?? void 0,
            message: trimmed,
            messages: history,
            productId: productId ?? void 0,
            model: modelOverride
          }),
          signal: controller.signal
        });
        if (!resp.ok) {
          if (resp.status === 429) {
            setError("Trop de requ\xEAtes \u2014 r\xE9essaie dans quelques secondes.");
          } else {
            const errData = await resp.json().catch(() => null);
            setError(errData?.error ?? "Erreur serveur \u2014 r\xE9essaie dans un instant.");
          }
          setMessages((prev) => prev.filter((m) => m.id !== assistantId));
          return;
        }
        if (!resp.body) {
          setError("Erreur serveur \u2014 r\xE9essaie dans un instant.");
          setMessages((prev) => prev.filter((m) => m.id !== assistantId));
          return;
        }
        const headerChatId = resp.headers.get("x-chat-id");
        if (headerChatId && headerChatId !== chatId) {
          setChatId(headerChatId);
          onChatId?.(headerChatId);
        }
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let assembled = "";
        let streamErrorDetected = false;
        const ERROR_MARKER = "\0ERROR:";
        let errorCarry = "";
        for (; ; ) {
          const { done, value } = await reader.read();
          if (done) break;
          const rawChunk = decoder.decode(value, { stream: true });
          const combined = errorCarry + rawChunk;
          const errIdx = combined.indexOf(ERROR_MARKER);
          if (errIdx !== -1) {
            const errPart = combined.slice(errIdx + ERROR_MARKER.length);
            const errMsg = errPart.split("\n")[0]?.trim() || "Erreur serveur \u2014 r\xE9essaie dans un instant.";
            setError(errMsg);
            streamErrorDetected = true;
            break;
          }
          const carryLen = Math.min(combined.length, ERROR_MARKER.length - 1);
          errorCarry = combined.slice(combined.length - carryLen);
          const chunk = combined.slice(0, combined.length - carryLen);
          const filtered = stripThink(chunk);
          if (filtered) {
            assembled += filtered;
            setMessages(
              (prev) => prev.map(
                (m) => m.id === assistantId ? { ...m, content: assembled } : m
              )
            );
          }
        }
        if (streamErrorDetected) {
          setMessages((prev) => prev.filter((m) => m.id !== assistantId));
          return;
        }
        const tail = stripThink(decoder.decode());
        if (tail) {
          assembled += tail;
          setMessages(
            (prev) => prev.map(
              (m) => m.id === assistantId ? { ...m, content: assembled } : m
            )
          );
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        const errMsg = err instanceof Error ? err.message : "Erreur inconnue";
        setError(errMsg);
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      } finally {
        if (mountedRef.current) {
          setStreaming(false);
        }
        abortRef.current = null;
        pendingRef.current = false;
      }
    },
    // messagesRef est stable — pas besoin de messages dans les deps.
    [apiEndpoint, chatId, productId, onChatId]
  );
  return { messages, streaming, error, sendMessage, reset };
}

// src/chat/ChatKimi.tsx
import { Fragment, jsx as jsx4, jsxs as jsxs3 } from "react/jsx-runtime";
function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function renderMarkdown(text) {
  return text.replace(
    /```(\w*)\n?([\s\S]*?)```/g,
    (_m, _lang, code) => `<pre style="background:rgba(0,0,0,0.4);padding:8px 10px;border-radius:6px;overflow-x:auto;font-size:12px;margin:6px 0;border:1px solid rgba(255,255,255,0.08)"><code>${escapeHtml(code.trimEnd())}</code></pre>`
  ).replace(
    /`([^`]+)`/g,
    (_m, c) => `<code style="background:rgba(0,0,0,0.35);padding:1px 5px;border-radius:3px;font-size:12px">${escapeHtml(c)}</code>`
  ).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>").replace(/((?:^[-*] .+$\n?)+)/gm, (block) => {
    const items = block.split("\n").filter(Boolean).map(
      (line) => `<li style="margin:2px 0">${line.replace(/^[-*] /, "")}</li>`
    ).join("");
    return `<ul style="padding-left:16px;margin:4px 0">${items}</ul>`;
  }).replace(/\n/g, "<br>");
}
function sanitizeHtml(html) {
  if (typeof window === "undefined") return "";
  return DOMPurify.sanitize(html);
}
function ChatKimi({ productName, productColor } = {}) {
  const [input, setInput] = useState3("");
  const bottomRef = useRef3(null);
  const textareaRef = useRef3(null);
  const activeProduct = useSyncExternalStore3(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );
  const activeChat = useSyncExternalStore3(
    subscribe5,
    getSnapshot5,
    getServerSnapshot5
  );
  const { chatConfig } = useCockpit();
  const { messages, streaming, error, sendMessage, reset } = useChat({
    apiEndpoint: chatConfig.apiEndpoint ?? "/api/cockpit-chat",
    persistence: chatConfig.persistence,
    productId: activeProduct,
    chatId: activeChat,
    onChatId: (id) => setActiveChat(id)
  });
  useEffect3(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  const newConversation = useCallback2(() => {
    setActiveChat(null);
    reset();
    setInput("");
  }, [reset]);
  const handleSend = useCallback2(
    (text) => {
      if (!text.trim() || streaming) return;
      setInput("");
      sendMessage(text);
      requestAnimationFrame(() => textareaRef.current?.focus());
    },
    [streaming, sendMessage]
  );
  const handleKeyDown = useCallback2(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend(input);
      }
    },
    [input, handleSend]
  );
  const retryLast = useCallback2(() => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    sendMessage(lastUser.content);
  }, [messages, sendMessage]);
  const accent = productColor ?? "var(--ct-accent, #8A1538)";
  return /* @__PURE__ */ jsxs3("div", { className: "ct-chat-root", children: [
    /* @__PURE__ */ jsx4("div", { className: "ct-chat-actionbar", children: /* @__PURE__ */ jsx4(
      "button",
      {
        type: "button",
        onClick: newConversation,
        title: "Nouvelle conversation",
        className: "ct-chat-newbtn",
        children: "+ Nouveau"
      }
    ) }),
    /* @__PURE__ */ jsxs3("div", { className: "ct-chat-list", children: [
      messages.length === 0 && !streaming && /* @__PURE__ */ jsxs3("p", { className: "ct-placeholder", children: [
        "Assistant Kimi K2.6",
        productName ? ` \u2014 contexte ${productName}.` : ".",
        /* @__PURE__ */ jsx4("br", {}),
        "Pose ta question pour d\xE9marrer."
      ] }),
      messages.map((msg) => {
        if (msg.role === "assistant" && msg.content === "") return null;
        return /* @__PURE__ */ jsx4(
          MessageBubble,
          {
            msg,
            isStreamingThis: streaming && msg.role === "assistant" && msg === messages[messages.length - 1],
            accent
          },
          msg.id
        );
      }),
      streaming && /* @__PURE__ */ jsx4(
        "div",
        {
          className: "ct-chat-thinking active",
          "aria-label": "L'assistant r\xE9fl\xE9chit",
          style: { color: accent },
          children: /* @__PURE__ */ jsx4(HearstMark, { size: 18 })
        }
      ),
      error && /* @__PURE__ */ jsxs3("div", { className: "ct-chat-error", children: [
        /* @__PURE__ */ jsx4("p", { children: error }),
        /* @__PURE__ */ jsx4("button", { type: "button", onClick: retryLast, className: "ct-chat-retry", children: "\u21BB R\xE9essayer" })
      ] }),
      /* @__PURE__ */ jsx4("div", { ref: bottomRef })
    ] }),
    /* @__PURE__ */ jsxs3(
      "form",
      {
        className: "ct-chat-form",
        onSubmit: (e) => {
          e.preventDefault();
          handleSend(input);
        },
        children: [
          /* @__PURE__ */ jsx4(
            "textarea",
            {
              ref: textareaRef,
              className: "ct-chat-input",
              rows: 2,
              placeholder: "Message \xE0 Kimi\u2026",
              value: input,
              onChange: (e) => setInput(e.target.value),
              onKeyDown: handleKeyDown,
              disabled: streaming
            }
          ),
          /* @__PURE__ */ jsx4(
            "button",
            {
              type: "submit",
              className: "ct-chat-send",
              disabled: !input.trim() || streaming,
              "aria-label": "Envoyer",
              style: input.trim() && !streaming ? { background: accent } : void 0,
              children: streaming ? /* @__PURE__ */ jsxs3("span", { className: "ct-chat-send-dots", children: [
                /* @__PURE__ */ jsx4("span", {}),
                /* @__PURE__ */ jsx4("span", {}),
                /* @__PURE__ */ jsx4("span", {})
              ] }) : /* @__PURE__ */ jsxs3(
                "svg",
                {
                  width: "16",
                  height: "16",
                  viewBox: "0 0 24 24",
                  fill: "none",
                  stroke: "currentColor",
                  strokeWidth: "2.4",
                  strokeLinecap: "round",
                  strokeLinejoin: "round",
                  "aria-hidden": "true",
                  children: [
                    /* @__PURE__ */ jsx4("line", { x1: "12", y1: "19", x2: "12", y2: "5" }),
                    /* @__PURE__ */ jsx4("polyline", { points: "5 12 12 5 19 12" })
                  ]
                }
              )
            }
          )
        ]
      }
    )
  ] });
}
function MessageBubble({ msg, isStreamingThis, accent }) {
  const isUser = msg.role === "user";
  const isEmpty = msg.content === "";
  return /* @__PURE__ */ jsx4("div", { className: `ct-chat-msg ${isUser ? "user" : "assistant"}`, children: isEmpty ? /* @__PURE__ */ jsxs3("div", { className: "ct-chat-typing", children: [
    /* @__PURE__ */ jsx4("span", {}),
    /* @__PURE__ */ jsx4("span", {}),
    /* @__PURE__ */ jsx4("span", {})
  ] }) : isUser ? /* @__PURE__ */ jsx4("p", { style: { whiteSpace: "pre-wrap" }, children: msg.content }) : /* @__PURE__ */ jsxs3(Fragment, { children: [
    /* @__PURE__ */ jsx4(
      "div",
      {
        dangerouslySetInnerHTML: {
          __html: sanitizeHtml(renderMarkdown(msg.content))
        }
      }
    ),
    isStreamingThis && /* @__PURE__ */ jsx4("span", { className: "ct-chat-cursor", style: { background: accent } })
  ] }) });
}

// src/chat/ChatSettings.tsx
import { useEffect as useEffect4, useState as useState4 } from "react";
import { jsx as jsx5, jsxs as jsxs4 } from "react/jsx-runtime";
var LS_API_KEY = "cockpit:hypercli-key";
var LS_MARKDOWN = "cockpit:chat-markdown";
var LS_SHOW_THINK = "cockpit:chat-show-think";
var LS_MODEL = "cockpit:chat-model";
var MODELS = [
  { value: "kimi-k2.6", label: "Kimi K2.6 (d\xE9faut)" },
  { value: "kimi-k2.6-anthropic", label: "Kimi K2.6 (Anthropic-compatible)" }
];
function ChatSettings({ productName, productColor } = {}) {
  const [apiKey, setApiKey] = useState4("");
  const [apiKeyDraft, setApiKeyDraft] = useState4("");
  const [markdown, setMarkdown] = useState4(true);
  const [showThink, setShowThink] = useState4(false);
  const [model, setModel] = useState4("kimi-k2.6");
  const [savedFlash, setSavedFlash] = useState4(false);
  useEffect4(() => {
    if (typeof window === "undefined") return;
    const k = window.localStorage.getItem(LS_API_KEY) ?? "";
    setApiKey(k);
    setApiKeyDraft(k);
    setMarkdown(window.localStorage.getItem(LS_MARKDOWN) !== "0");
    setShowThink(window.localStorage.getItem(LS_SHOW_THINK) === "1");
    setModel(window.localStorage.getItem(LS_MODEL) ?? "kimi-k2.6");
  }, []);
  function saveApiKey() {
    window.localStorage.setItem(LS_API_KEY, apiKeyDraft);
    setApiKey(apiKeyDraft);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1600);
  }
  function updateBool(key, val) {
    window.localStorage.setItem(key, val ? "1" : "0");
  }
  return /* @__PURE__ */ jsxs4("div", { className: "ct-chat-settings", children: [
    /* @__PURE__ */ jsxs4("section", { className: "ct-chat-settings-section", children: [
      /* @__PURE__ */ jsx5("div", { className: "ct-chat-settings-label", children: "Cl\xE9 API Hypercli" }),
      /* @__PURE__ */ jsxs4("div", { className: "ct-chat-settings-row", children: [
        /* @__PURE__ */ jsx5(
          "input",
          {
            type: "password",
            className: "ct-chat-settings-input",
            value: apiKeyDraft,
            onChange: (e) => setApiKeyDraft(e.target.value),
            placeholder: "hcp-\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
            autoComplete: "off",
            spellCheck: false
          }
        ),
        /* @__PURE__ */ jsx5(
          "button",
          {
            type: "button",
            className: "ct-chat-settings-save",
            onClick: saveApiKey,
            disabled: apiKeyDraft === apiKey,
            style: productColor && apiKeyDraft !== apiKey ? { background: productColor } : void 0,
            children: savedFlash ? "\u2713" : "Save"
          }
        )
      ] }),
      apiKey && !savedFlash && /* @__PURE__ */ jsx5("div", { className: "ct-chat-settings-hint", children: "\u2713 Cl\xE9 enregistr\xE9e localement" }),
      savedFlash && /* @__PURE__ */ jsx5("div", { className: "ct-chat-settings-hint", children: "\u2713 Mise \xE0 jour" })
    ] }),
    /* @__PURE__ */ jsxs4("section", { className: "ct-chat-settings-section", children: [
      /* @__PURE__ */ jsx5("div", { className: "ct-chat-settings-label", children: "Mod\xE8le" }),
      /* @__PURE__ */ jsx5(
        "select",
        {
          className: "ct-chat-settings-select",
          value: model,
          onChange: (e) => {
            setModel(e.target.value);
            window.localStorage.setItem(LS_MODEL, e.target.value);
          },
          children: MODELS.map((m) => /* @__PURE__ */ jsx5("option", { value: m.value, children: m.label }, m.value))
        }
      ),
      /* @__PURE__ */ jsx5("div", { className: "ct-chat-settings-hint", children: "Contexte 256k tokens \xB7 drop-in OpenAI/Anthropic" })
    ] }),
    /* @__PURE__ */ jsxs4("section", { className: "ct-chat-settings-section", children: [
      /* @__PURE__ */ jsx5("div", { className: "ct-chat-settings-label", children: "Affichage" }),
      /* @__PURE__ */ jsxs4("label", { className: "ct-chat-settings-toggle", children: [
        /* @__PURE__ */ jsx5(
          "input",
          {
            type: "checkbox",
            checked: markdown,
            onChange: (e) => {
              setMarkdown(e.target.checked);
              updateBool(LS_MARKDOWN, e.target.checked);
            }
          }
        ),
        /* @__PURE__ */ jsx5("span", { children: "Rendu Markdown" })
      ] }),
      /* @__PURE__ */ jsxs4("label", { className: "ct-chat-settings-toggle", children: [
        /* @__PURE__ */ jsx5(
          "input",
          {
            type: "checkbox",
            checked: showThink,
            onChange: (e) => {
              setShowThink(e.target.checked);
              updateBool(LS_SHOW_THINK, e.target.checked);
            }
          }
        ),
        /* @__PURE__ */ jsx5("span", { children: "Afficher le raisonnement <think>" })
      ] })
    ] }),
    /* @__PURE__ */ jsxs4("section", { className: "ct-chat-settings-section", children: [
      /* @__PURE__ */ jsx5("div", { className: "ct-chat-settings-label", children: "Contexte produit" }),
      /* @__PURE__ */ jsxs4("div", { className: "ct-chat-settings-product", children: [
        /* @__PURE__ */ jsx5(
          "span",
          {
            className: "ct-chat-ctx-dot",
            style: { background: productColor ?? "var(--ct-accent)" }
          }
        ),
        /* @__PURE__ */ jsx5("span", { className: "ct-chat-settings-product-name", children: productName ?? "\u2014" })
      ] }),
      /* @__PURE__ */ jsx5("div", { className: "ct-chat-settings-hint", children: "L'assistant conna\xEEt ce produit automatiquement et adapte ses r\xE9ponses." })
    ] })
  ] });
}

// src/chat/ChatHistory.tsx
import { useCallback as useCallback3, useEffect as useEffect5, useState as useState5 } from "react";
import { jsx as jsx6, jsxs as jsxs5 } from "react/jsx-runtime";
function ChatHistory({ productColor } = {}) {
  const [chats, setChats] = useState5([]);
  const [loading, setLoading] = useState5(true);
  const [error, setError] = useState5(null);
  const load = useCallback3(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cockpit-chats", { cache: "no-store" });
      if (!res.ok) throw new Error("load_failed");
      const data = await res.json();
      setChats(data.chats);
    } catch {
      setError("Impossible de charger l'historique.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect5(() => {
    void load();
  }, [load]);
  async function selectChat(id) {
    setActiveChat(id);
    setView("chat");
  }
  async function newChat() {
    setActiveChat(null);
    setView("chat");
  }
  async function deleteChat(id) {
    if (!window.confirm("Supprimer cette conversation ?")) return;
    try {
      await fetch(`/api/cockpit-chats/${id}`, { method: "DELETE" });
      setChats((prev) => prev.filter((c) => c.id !== id));
    } catch {
    }
  }
  async function clearAll() {
    if (!window.confirm("Tout supprimer ? Cette action est irr\xE9versible.")) return;
    try {
      await fetch("/api/cockpit-chats", { method: "DELETE" });
      setChats([]);
    } catch {
    }
  }
  return /* @__PURE__ */ jsxs5("div", { className: "ct-chat-history", children: [
    /* @__PURE__ */ jsxs5("div", { className: "ct-chat-history-actions", children: [
      /* @__PURE__ */ jsx6(
        "button",
        {
          type: "button",
          className: "ct-chat-history-newbtn",
          onClick: newChat,
          style: productColor ? { background: productColor } : void 0,
          children: "+ Nouvelle conversation"
        }
      ),
      chats.length > 0 && /* @__PURE__ */ jsx6(
        "button",
        {
          type: "button",
          className: "ct-chat-history-clearbtn",
          onClick: clearAll,
          title: "Tout supprimer",
          children: "Tout effacer"
        }
      )
    ] }),
    loading && /* @__PURE__ */ jsx6("p", { className: "ct-placeholder", children: "Chargement\u2026" }),
    error && /* @__PURE__ */ jsx6("p", { className: "ct-chat-error", children: error }),
    !loading && !error && chats.length === 0 && /* @__PURE__ */ jsx6("p", { className: "ct-placeholder", children: "Aucune conversation pour l'instant \u2014 d\xE9marre un chat pour voir appara\xEEtre ton historique ici." }),
    /* @__PURE__ */ jsx6("ul", { className: "ct-chat-history-list", children: chats.map((c) => /* @__PURE__ */ jsxs5("li", { className: "ct-chat-history-item", children: [
      /* @__PURE__ */ jsxs5(
        "button",
        {
          type: "button",
          className: "ct-chat-history-item-main",
          onClick: () => selectChat(c.id),
          children: [
            /* @__PURE__ */ jsx6("span", { className: "ct-chat-history-title", children: c.title }),
            /* @__PURE__ */ jsx6("span", { className: "ct-chat-history-date", children: formatDate(c.updated_at) })
          ]
        }
      ),
      /* @__PURE__ */ jsx6(
        "button",
        {
          type: "button",
          className: "ct-chat-history-delete",
          onClick: () => deleteChat(c.id),
          "aria-label": "Supprimer",
          title: "Supprimer",
          children: /* @__PURE__ */ jsx6("svg", { width: "13", height: "13", viewBox: "0 0 13 13", fill: "none", "aria-hidden": "true", children: /* @__PURE__ */ jsx6("path", { d: "M1.5 3h10M4.5 3V2a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5v1M5.5 5.5v4M7.5 5.5v4M2.5 3l.5 8a.5.5 0 0 0 .5.5h6a.5.5 0 0 0 .5-.5l.5-8", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" }) })
        }
      )
    ] }, c.id)) })
  ] });
}
function formatDate(iso) {
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  const min = Math.floor(diff / 6e4);
  if (min < 1) return "\xE0 l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `il y a ${days} j`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

// src/shell/RailRight.tsx
import { Fragment as Fragment2, jsx as jsx7, jsxs as jsxs6 } from "react/jsx-runtime";
var TITLES = {
  chat: "Assistant",
  settings: "R\xE9glages",
  history: "Historique"
};
function RailRight() {
  const open = useSyncExternalStore4(subscribe3, getSnapshot3, getServerSnapshot3);
  const active = useSyncExternalStore4(subscribe, getSnapshot, getServerSnapshot);
  const view = useSyncExternalStore4(subscribe4, getSnapshot4, getServerSnapshot4);
  const { appId, getProduct } = useCockpit();
  const product = getProduct(active);
  const inProduct = active !== appId;
  return /* @__PURE__ */ jsxs6("aside", { className: `ct-rail-right${open ? "" : " collapsed"}`, children: [
    /* @__PURE__ */ jsxs6("div", { className: "ct-rail-right-header", children: [
      open && /* @__PURE__ */ jsxs6("span", { className: "ct-rail-right-title", children: [
        /* @__PURE__ */ jsx7(
          "span",
          {
            className: "ct-chat-ctx-dot",
            style: { background: product.color }
          }
        ),
        TITLES[view] ?? "Assistant",
        /* @__PURE__ */ jsxs6("span", { className: "ct-chat-ctx-name", children: [
          "\xB7 ",
          product.name
        ] })
      ] }),
      open && /* @__PURE__ */ jsxs6(Fragment2, { children: [
        /* @__PURE__ */ jsx7(
          "button",
          {
            className: `ct-rail-right-btn${view === "history" ? " active" : ""}`,
            onClick: () => setView(view === "history" ? "chat" : "history"),
            "aria-label": view === "history" ? "Retour au chat" : "Historique",
            title: view === "history" ? "Retour au chat" : "Historique",
            children: /* @__PURE__ */ jsxs6("svg", { width: "13", height: "13", viewBox: "0 0 13 13", fill: "none", "aria-hidden": "true", children: [
              /* @__PURE__ */ jsx7("circle", { cx: "6.5", cy: "6.5", r: "5", stroke: "currentColor", strokeWidth: "1.2" }),
              /* @__PURE__ */ jsx7("path", { d: "M6.5 3.5V6.5L8.5 7.5", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round", strokeLinejoin: "round" })
            ] })
          }
        ),
        /* @__PURE__ */ jsx7(
          "button",
          {
            className: `ct-rail-right-btn${view === "settings" ? " active" : ""}`,
            onClick: () => setView(view === "settings" ? "chat" : "settings"),
            "aria-label": view === "settings" ? "Retour au chat" : "Param\xE8tres",
            title: view === "settings" ? "Retour au chat" : "Param\xE8tres",
            children: /* @__PURE__ */ jsxs6("svg", { width: "13", height: "13", viewBox: "0 0 13 13", fill: "none", "aria-hidden": "true", children: [
              /* @__PURE__ */ jsx7("circle", { cx: "6.5", cy: "6.5", r: "1.75", stroke: "currentColor", strokeWidth: "1.2" }),
              /* @__PURE__ */ jsx7("path", { d: "M6.5 1v1.5M6.5 10.5V12M12 6.5h-1.5M2.5 6.5H1M10.3 2.7l-1.06 1.06M3.76 9.24l-1.06 1.06M10.3 10.3l-1.06-1.06M3.76 3.76 2.7 2.7", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round" })
            ] })
          }
        )
      ] }),
      /* @__PURE__ */ jsx7(
        "button",
        {
          className: "ct-rail-right-btn",
          onClick: toggle,
          "aria-label": open ? "Replier le chat" : "D\xE9plier le chat",
          title: open ? "Replier" : "D\xE9plier",
          children: open ? "\u203A" : "\u2039"
        }
      )
    ] }),
    /* @__PURE__ */ jsxs6("div", { className: "ct-rail-right-body", children: [
      view === "settings" && /* @__PURE__ */ jsx7(ChatSettings, { productName: product.name, productColor: product.color }),
      view === "history" && /* @__PURE__ */ jsx7(ChatHistory, { productColor: product.color }),
      view === "chat" && /* @__PURE__ */ jsx7(ChatKimi, { productName: product.name, productColor: product.color })
    ] })
  ] });
}

// src/shell/ThemeAccent.tsx
import { useLayoutEffect, useSyncExternalStore as useSyncExternalStore5 } from "react";
function ThemeAccent() {
  const active = useSyncExternalStore5(subscribe, getSnapshot, getServerSnapshot);
  const { getProduct } = useCockpit();
  useLayoutEffect(() => {
    const { color } = getProduct(active);
    const root = document.documentElement;
    root.style.setProperty("--ct-accent", color);
    return () => {
      root.style.removeProperty("--ct-accent");
    };
  }, [active, getProduct]);
  return null;
}

// src/shell/HubBottomBar.tsx
import { useEffect as useEffect6, useState as useState6, useSyncExternalStore as useSyncExternalStore6 } from "react";
import { jsx as jsx8, jsxs as jsxs7 } from "react/jsx-runtime";
function HubBottomBar() {
  const active = useSyncExternalStore6(subscribe, getSnapshot, getServerSnapshot);
  const { appId, getProduct } = useCockpit();
  const product = getProduct(appId);
  const [pathname, setPathname] = useState6("/");
  useEffect6(() => {
    setPathname(window.location.pathname);
    const handler = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);
  if (active !== appId) return null;
  const onOverview = pathname === "/";
  return /* @__PURE__ */ jsxs7("div", { className: "ct-hub-bar", children: [
    /* @__PURE__ */ jsxs7("span", { className: "ct-hub-bar-label", children: [
      /* @__PURE__ */ jsx8(
        "span",
        {
          className: "ct-chat-ctx-dot",
          style: { background: product.color }
        }
      ),
      "Cockpit"
    ] }),
    /* @__PURE__ */ jsx8("div", { className: "ct-hub-bar-track", children: /* @__PURE__ */ jsx8(
      "button",
      {
        type: "button",
        className: `ct-hub-bar-seg${onOverview ? " active" : ""}`,
        onClick: () => {
          if (!onOverview) window.location.href = "/";
        },
        children: "Overview"
      }
    ) })
  ] });
}

// src/shell/CockpitShell.tsx
import { jsx as jsx9, jsxs as jsxs8 } from "react/jsx-runtime";
function CockpitShell({
  children,
  products,
  appId,
  chatConfig,
  renderActiveProduct
}) {
  useEffect7(() => {
    setDefaultActive(appId);
  }, [appId]);
  const [isElectron, setIsElectron] = useState7(false);
  useEffect7(() => {
    setIsElectron(
      typeof window !== "undefined" && typeof window.electron === "object"
    );
  }, []);
  const active = useSyncExternalStore7(subscribe, getSnapshot, getServerSnapshot);
  const ctx = useMemo(() => {
    const map = /* @__PURE__ */ new Map();
    for (const p of products) map.set(p.id, p);
    const fallback = map.get(appId) ?? products[0] ?? {
      id: "hub",
      name: "Hearst Corporation",
      short: "HC",
      color: "#8A1538"
    };
    return {
      products,
      appId,
      chatConfig: chatConfig ?? {},
      getProduct: (id) => map.get(id) ?? fallback
    };
  }, [products, appId, chatConfig]);
  const inProduct = active !== appId;
  return /* @__PURE__ */ jsx9(CockpitContext.Provider, { value: ctx, children: /* @__PURE__ */ jsxs8("div", { className: `ct-root${isElectron ? " ct-electron" : " ct-web"}`, children: [
    /* @__PURE__ */ jsx9(ThemeAccent, {}),
    isElectron && /* @__PURE__ */ jsx9("div", { className: "ct-drag" }),
    /* @__PURE__ */ jsx9("div", { className: "ct-ambient-deep" }),
    /* @__PURE__ */ jsx9("div", { className: "ct-ambient-glow" }),
    /* @__PURE__ */ jsxs8("div", { className: `ct-panels-row${inProduct ? " ct-immersif" : ""}`, children: [
      /* @__PURE__ */ jsx9(RailLeft, {}),
      /* @__PURE__ */ jsx9(CenterPanel, { ...renderActiveProduct !== void 0 ? { renderProduct: renderActiveProduct } : {}, children }),
      /* @__PURE__ */ jsx9(RailRight, {})
    ] }),
    inProduct && /* @__PURE__ */ jsx9(
      "button",
      {
        type: "button",
        className: "ct-master-fab",
        onClick: () => setActive(appId),
        title: "Retour au hub Master",
        children: "Master"
      }
    ),
    /* @__PURE__ */ jsx9(HubBottomBar, {})
  ] }) });
}

// src/shell/hubBridge.ts
var CH_REQ = "hearsthub:req";
var CH_RES = "hearsthub:res";
var CH_CTX = "hearsthub:ctx";
function isHubReqPayload(v) {
  if (!v || typeof v !== "object") return false;
  const p = v;
  return typeof p["reqId"] === "number" && typeof p["channel"] === "string" && p["channel"].length > 0;
}
function attachHubBridge(webviewEl, getProductId) {
  const handler = async (e) => {
    if (e.channel !== CH_REQ) return;
    const raw = e.args[0];
    if (!isHubReqPayload(raw)) return;
    const payload = raw;
    const { reqId, channel, args } = payload;
    if (channel === "telemetry" || typeof reqId === "number" && reqId < 0) {
      if (process.env.NODE_ENV === "development") {
        console.debug("[hubBridge] telemetry drop", { channel, args });
      }
      return;
    }
    if (typeof window.electron?.hubInvoke !== "function") {
      webviewEl.send(CH_RES, { reqId, ok: false, error: "no bridge" });
      return;
    }
    const productId = getProductId();
    try {
      const r = await window.electron.hubInvoke(channel, { productId, args });
      if (r && typeof r === "object" && "ok" in r && r.ok === false) {
        webviewEl.send(CH_RES, {
          reqId,
          ok: false,
          error: r.error ?? "HubError"
        });
      } else {
        const result = r && typeof r === "object" && "result" in r ? r.result : r;
        webviewEl.send(CH_RES, { reqId, ok: true, result });
      }
    } catch (err) {
      webviewEl.send(CH_RES, { reqId, ok: false, error: String(err) });
    }
  };
  webviewEl.addEventListener("ipc-message", handler);
  return () => {
    webviewEl.removeEventListener("ipc-message", handler);
  };
}
function pushContext(webviewEl, ctx) {
  webviewEl.send(CH_CTX, ctx);
}

// src/primitives/index.tsx
import { jsx as jsx10, jsxs as jsxs9 } from "react/jsx-runtime";
function Eyebrow({ children }) {
  return /* @__PURE__ */ jsx10("div", { className: "ct-eyebrow", children });
}
function Title({ children }) {
  return /* @__PURE__ */ jsx10("h1", { className: "ct-title", children });
}
function Sub({ children }) {
  return /* @__PURE__ */ jsx10("p", { className: "ct-sub", children });
}
function KpiGrid({ children }) {
  return /* @__PURE__ */ jsx10("div", { className: "ct-kpi-grid", children });
}
function KpiCard({
  label,
  value,
  accent = false
}) {
  return /* @__PURE__ */ jsxs9("div", { className: `ct-kpi-card${accent ? " accent" : ""}`, children: [
    /* @__PURE__ */ jsx10("div", { className: "ct-kpi-label", children: label }),
    /* @__PURE__ */ jsx10("div", { className: "ct-kpi-value", children: value })
  ] });
}
function Card({
  title,
  children
}) {
  return /* @__PURE__ */ jsxs9("div", { className: "ct-card", children: [
    /* @__PURE__ */ jsx10("div", { className: "ct-card-title", children: title }),
    /* @__PURE__ */ jsx10("div", { className: "ct-card-body", children })
  ] });
}
export {
  Card,
  CenterPanel,
  ChatHistory,
  ChatKimi,
  ChatSettings,
  CockpitShell,
  Eyebrow,
  HearstMark,
  KpiCard,
  KpiGrid,
  RailLeft,
  RailRight,
  Sub,
  ThemeAccent,
  Title,
  attachHubBridge,
  forceOpen as forceOpenRailRight,
  getSnapshot as getActiveProduct,
  pushContext,
  setActive as setActiveProduct,
  setDefaultActive,
  subscribe as subscribeActiveProduct,
  subscribe2 as subscribeLauncher,
  subscribe3 as subscribeRailRight,
  useChat,
  useCockpit
};
