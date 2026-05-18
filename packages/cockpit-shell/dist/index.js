"use client";

// src/shell/CockpitShell.tsx
import { useEffect as useEffect3, useMemo, useSyncExternalStore as useSyncExternalStore7 } from "react";

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
import { useSyncExternalStore } from "react";

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
  const current = getProduct(active);
  const inProduct = current.id !== appId;
  const label = (name) => name.replace(/^Hearst\s+/, "");
  const top = inProduct && !open ? current : getProduct(appId);
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
    /* @__PURE__ */ jsx2("div", { className: "ct-avatar", title: appId, children: (getProduct(appId).short || "HC").slice(0, 2).toUpperCase() })
  ] });
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

// src/chat/ChatKimi.tsx
import {
  useCallback as useCallback2,
  useEffect as useEffect2,
  useRef as useRef2,
  useState as useState2,
  useSyncExternalStore as useSyncExternalStore3
} from "react";
import DOMPurify from "dompurify";

// src/chat/useChat.ts
import { useCallback, useEffect, useRef, useState } from "react";
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
function useChat(opts) {
  const {
    apiEndpoint = "/api/cockpit-chat",
    chatId: initialChatId = null,
    onChatId,
    persistence,
    productId = null
  } = opts ?? {};
  const [messages, setMessages] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [chatId, setChatId] = useState(initialChatId ?? null);
  const abortRef = useRef(null);
  const pendingRef = useRef(false);
  const mountedRef = useRef(true);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  useEffect(() => {
    if (!persistence || !chatId) return;
    let cancelled = false;
    persistence.loadMessages(chatId).then((loaded) => {
      if (!cancelled) setMessages(loaded);
    }).catch(() => {
    });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);
  const reset = useCallback(() => {
    abortRef.current?.abort();
    pendingRef.current = false;
    setMessages([]);
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
      try {
        const resp = await fetch(apiEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chatId: chatId ?? void 0,
            message: trimmed,
            messages: history,
            productId: productId ?? void 0
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
  const [input, setInput] = useState2("");
  const bottomRef = useRef2(null);
  const textareaRef = useRef2(null);
  const activeProduct = useSyncExternalStore3(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );
  const { chatConfig } = useCockpit();
  const { messages, streaming, error, sendMessage, reset } = useChat({
    apiEndpoint: chatConfig.apiEndpoint ?? "/api/cockpit-chat",
    persistence: chatConfig.persistence,
    productId: activeProduct
  });
  useEffect2(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  const newConversation = useCallback2(() => {
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
      messages.map((msg) => /* @__PURE__ */ jsx4(
        MessageBubble,
        {
          msg,
          isStreamingThis: streaming && msg.role === "assistant" && msg === messages[messages.length - 1],
          accent
        },
        msg.id
      )),
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
              style: { background: input.trim() && !streaming ? accent : void 0 },
              children: streaming ? "\u2026" : "\u2191"
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

// src/shell/RailRight.tsx
import { jsx as jsx5, jsxs as jsxs4 } from "react/jsx-runtime";
function RailRight() {
  const open = useSyncExternalStore4(subscribe3, getSnapshot3, getServerSnapshot3);
  const active = useSyncExternalStore4(subscribe, getSnapshot, getServerSnapshot);
  const { getProduct } = useCockpit();
  const product = getProduct(active);
  return /* @__PURE__ */ jsxs4("aside", { className: `ct-rail-right${open ? "" : " collapsed"}`, children: [
    /* @__PURE__ */ jsxs4("div", { className: "ct-rail-right-header", children: [
      open && /* @__PURE__ */ jsxs4("span", { className: "ct-rail-right-title", children: [
        /* @__PURE__ */ jsx5(
          "span",
          {
            className: "ct-chat-ctx-dot",
            style: { background: product.color }
          }
        ),
        "Assistant",
        /* @__PURE__ */ jsxs4("span", { className: "ct-chat-ctx-name", children: [
          "\xB7 ",
          product.name
        ] })
      ] }),
      /* @__PURE__ */ jsx5(
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
    /* @__PURE__ */ jsx5("div", { className: "ct-rail-right-body", children: /* @__PURE__ */ jsx5(ChatKimi, { productName: product.name, productColor: product.color }) })
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

// src/shell/ProductBottomBar.tsx
import { useSyncExternalStore as useSyncExternalStore6 } from "react";
import { Fragment as Fragment2, jsx as jsx6, jsxs as jsxs5 } from "react/jsx-runtime";
function BottomBar({
  label = "\u25CF Cockpit",
  segments = [{ label: "Overview", href: "/", active: true }],
  actions = [],
  children
}) {
  return /* @__PURE__ */ jsx6("div", { className: "ct-bottom-bar", children: /* @__PURE__ */ jsx6("div", { className: "ct-bottom-bar-inner", children: children ?? /* @__PURE__ */ jsxs5(Fragment2, { children: [
    /* @__PURE__ */ jsx6("span", { className: "ct-bottom-label", children: label }),
    /* @__PURE__ */ jsx6("div", { className: "ct-seg-track", children: segments.map((s) => /* @__PURE__ */ jsx6(
      "a",
      {
        href: s.href ?? "#",
        className: `ct-seg-btn${s.active ? " active" : ""}`,
        children: s.label
      },
      s.label
    )) }),
    actions.length > 0 && /* @__PURE__ */ jsx6("div", { className: "ct-seg-track", children: actions.map((a) => /* @__PURE__ */ jsx6(
      "button",
      {
        className: `ct-seg-btn${a.primary ? " primary" : ""}`,
        onClick: a.onClick,
        children: a.label
      },
      a.label
    )) })
  ] }) }) });
}
function ProductBottomBar({ bottomBar }) {
  const active = useSyncExternalStore6(subscribe, getSnapshot, getServerSnapshot);
  const { appId, getProduct } = useCockpit();
  const product = getProduct(active);
  if (product.id === appId) {
    return /* @__PURE__ */ jsx6(BottomBar, { label: `\u25CF ${product.name}`, children: bottomBar });
  }
  return /* @__PURE__ */ jsx6(
    BottomBar,
    {
      label: `\u25CF ${product.name}`,
      segments: [{ label: "Produit", active: true }],
      actions: [{ label: "\u2190 Retour", onClick: () => setActive(appId) }]
    }
  );
}

// src/shell/CockpitShell.tsx
import { jsx as jsx7, jsxs as jsxs6 } from "react/jsx-runtime";
function CockpitShell({
  children,
  products,
  appId,
  chatConfig,
  renderActiveProduct,
  bottomBar
}) {
  useEffect3(() => {
    setDefaultActive(appId);
  }, [appId]);
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
  return /* @__PURE__ */ jsx7(CockpitContext.Provider, { value: ctx, children: /* @__PURE__ */ jsxs6("div", { className: "ct-root", children: [
    /* @__PURE__ */ jsx7(ThemeAccent, {}),
    /* @__PURE__ */ jsx7("div", { className: "ct-drag" }),
    /* @__PURE__ */ jsx7("div", { className: "ct-ambient-deep" }),
    /* @__PURE__ */ jsx7("div", { className: "ct-ambient-glow" }),
    /* @__PURE__ */ jsxs6("div", { className: `ct-panels-row${inProduct ? " ct-immersif" : ""}`, children: [
      /* @__PURE__ */ jsx7(RailLeft, {}),
      /* @__PURE__ */ jsx7(CenterPanel, { ...renderActiveProduct !== void 0 ? { renderProduct: renderActiveProduct } : {}, children }),
      /* @__PURE__ */ jsx7(RailRight, {})
    ] }),
    /* @__PURE__ */ jsx7(ProductBottomBar, { bottomBar })
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
import { jsx as jsx8, jsxs as jsxs7 } from "react/jsx-runtime";
function Eyebrow({ children }) {
  return /* @__PURE__ */ jsx8("div", { className: "ct-eyebrow", children });
}
function Title({ children }) {
  return /* @__PURE__ */ jsx8("h1", { className: "ct-title", children });
}
function Sub({ children }) {
  return /* @__PURE__ */ jsx8("p", { className: "ct-sub", children });
}
function KpiGrid({ children }) {
  return /* @__PURE__ */ jsx8("div", { className: "ct-kpi-grid", children });
}
function KpiCard({
  label,
  value,
  accent = false
}) {
  return /* @__PURE__ */ jsxs7("div", { className: `ct-kpi-card${accent ? " accent" : ""}`, children: [
    /* @__PURE__ */ jsx8("div", { className: "ct-kpi-label", children: label }),
    /* @__PURE__ */ jsx8("div", { className: "ct-kpi-value", children: value })
  ] });
}
function Card({
  title,
  children
}) {
  return /* @__PURE__ */ jsxs7("div", { className: "ct-card", children: [
    /* @__PURE__ */ jsx8("div", { className: "ct-card-title", children: title }),
    /* @__PURE__ */ jsx8("div", { className: "ct-card-body", children })
  ] });
}
export {
  Card,
  CenterPanel,
  ChatKimi,
  CockpitShell,
  Eyebrow,
  HearstMark,
  KpiCard,
  KpiGrid,
  ProductBottomBar,
  RailLeft,
  RailRight,
  Sub,
  ThemeAccent,
  Title,
  attachHubBridge,
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
