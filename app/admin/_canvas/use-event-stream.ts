/**
 * EventSource live tail vers /api/admin/events-stream.
 *
 * Quand `active === true`, ouvre une connexion SSE, parse chaque RunEvent
 * et le route vers le canvas store : transitions d'états node + packets sur
 * les edges traversées. À `false`, ferme la connexion (le browser arrête
 * aussi son auto-reconnect interne).
 *
 * Le mapping event → node est volontairement permissif (skip silencieux
 * sur événements inconnus) — l'event bus est riche, la canvas n'en
 * matérialise qu'une projection.
 */

"use client";

import { useEffect } from "react";
import type { StepActor } from "@/lib/engine/runtime/engine/types";
import type { RunEvent } from "@/lib/events/types";
import { useCanvasStore } from "./store";
import type { NodeId } from "./topology";

/**
 * Acteur runtime → node canvas. Tous les sous-agents (Communicator, Planner,
 * DocBuilder, *Agent…) tombent sur le node "agent" : la branche delegate
 * regroupe la délégation multi-agents sans démultiplier les nodes.
 */
const NODE_BY_ACTOR: Record<StepActor, NodeId | null> = {
  orchestrator: "router",
  Communicator: "agent",
  KnowledgeRetriever: "research",
  Planner: "agent",
  DocBuilder: "agent",
  Analyst: "agent",
  Operator: "agent",
  FinanceAgent: "agent",
  CRMAgent: "agent",
  ProductivityAgent: "agent",
  DesignAgent: "agent",
  DeveloperAgent: "agent",
  runtime: null,
  anthropic_managed: "tools",
};

interface CanvasStoreApi {
  setNodeState: (
    id: NodeId,
    state: "idle" | "active" | "success" | "failed" | "blocked" | "disabled",
  ) => void;
  resetNodes: () => void;
  emitPacket: (edgeId: string) => void;
  setLastEventAt: (ts: number) => void;
}

function applyEventToStore(ev: RunEvent, store: CanvasStoreApi): void {
  switch (ev.type) {
    case "run_created":
      store.setNodeState("entry", "active");
      break;
    case "run_started":
      store.setNodeState("entry", "success");
      store.setNodeState("router", "active");
      store.emitPacket("e_entry_router");
      break;
    case "run_completed":
      store.setNodeState("complete", "success");
      break;
    case "run_failed":
      store.setNodeState("complete", "failed");
      break;
    case "run_aborted":
    case "run_cancelled":
      store.setNodeState("complete", "blocked");
      break;
    case "step_started": {
      const node = NODE_BY_ACTOR[ev.agent];
      if (node) store.setNodeState(node, "active");
      break;
    }
    case "step_completed": {
      const node = NODE_BY_ACTOR[ev.agent];
      if (node) store.setNodeState(node, "success");
      break;
    }
    case "tool_call_started":
      store.setNodeState("tools", "active");
      store.emitPacket("e_preflight_tools");
      break;
    case "tool_call_completed":
      store.setNodeState("tools", "success");
      break;
    case "delegate_enqueued":
      store.setNodeState("agent", "active");
      store.emitPacket("e_preflight_agent");
      break;
    case "delegate_completed":
      store.setNodeState("agent", "success");
      break;
    case "plan_attached":
    case "plan_preview":
      store.setNodeState("preflight", "active");
      break;
    case "plan_step_completed":
    case "plan_run_complete":
      store.setNodeState("preflight", "success");
      break;
    default:
      // Événement non mappé sur la canvas — bruit normal.
      return;
  }
  store.setLastEventAt(Date.now());
}

interface StreamMessage {
  type: string;
  [key: string]: unknown;
}

function isRunEvent(value: unknown): value is RunEvent {
  if (!value || typeof value !== "object") return false;
  const t = (value as StreamMessage).type;
  return typeof t === "string" && t !== "stream_open";
}

/**
 * Active la connexion SSE quand `active === true`. À l'activation, reset le
 * canvas (tous les nodes en idle) pour que les transitions reflètent l'état
 * live et non l'état figé d'une session précédente.
 */
export function useEventStream(active: boolean): void {
  useEffect(() => {
    if (!active) return;

    useCanvasStore.getState().resetNodes();

    const es = new EventSource("/api/admin/events-stream", { withCredentials: true });

    es.onmessage = (msg) => {
      try {
        const parsed: unknown = JSON.parse(msg.data);
        if (!isRunEvent(parsed)) return;
        applyEventToStore(parsed, useCanvasStore.getState());
      } catch {
        // Frame malformée — on ignore silencieusement (le bus peut envoyer des heartbeats).
      }
    };

    es.addEventListener("session_expired", () => {
      es.close();
      // Session expirée côté serveur — rechargement pour déclencher le flow
      // d'authentification NextAuth (redirect login automatique).
      window.location.reload();
    });

    es.onerror = () => {
      // EventSource gère son auto-reconnect ; on laisse le browser faire.
    };

    return () => {
      es.close();
    };
  }, [active]);
}
