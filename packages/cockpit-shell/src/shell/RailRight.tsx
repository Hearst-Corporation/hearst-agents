"use client";

import { useSyncExternalStore } from "react";
import {
  subscribe,
  getSnapshot,
  getServerSnapshot,
  toggle,
} from "../stores/railOpenStore";
import {
  subscribe as subActive,
  getSnapshot as getActive,
  getServerSnapshot as getActiveSSR,
} from "../stores/activeProductStore";
import { ChatKimi } from "../chat/ChatKimi";
import { useCockpit } from "./context";

export function RailRight() {
  const open = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const active = useSyncExternalStore(subActive, getActive, getActiveSSR);
  const { getProduct } = useCockpit();
  const product = getProduct(active);

  return (
    <aside className={`ct-rail-right${open ? "" : " collapsed"}`}>
      <div className="ct-rail-right-header">
        {open && (
          <span className="ct-rail-right-title">
            <span
              className="ct-chat-ctx-dot"
              style={{ background: product.color }}
            />
            Assistant
            <span className="ct-chat-ctx-name">· {product.name}</span>
          </span>
        )}
        <button
          className="ct-rail-right-btn"
          onClick={toggle}
          aria-label={open ? "Replier le chat" : "Déplier le chat"}
          title={open ? "Replier" : "Déplier"}
        >
          {open ? "›" : "‹"}
        </button>
      </div>
      {/* ChatKimi reste TOUJOURS monté — masqué en CSS quand replié. */}
      <div className="ct-rail-right-body">
        <ChatKimi productName={product.name} productColor={product.color} />
      </div>
    </aside>
  );
}
