/**
 * Template hospitality — Dispatch service request guest.
 * Webhook (in-app messaging / front desk app) → classify priority (Haiku)
 * → si urgent → Slack alert manager, sinon routing standard
 * → asset ticket (TOUJOURS émis — le dispatch a bien eu lieu)
 * → update PMS status (best-effort, skip si PMS non configuré)
 *   → edge error → out_pms_update_skipped (avertissement honnête).
 *
 * Invariant : le node `out` (ticket de traçabilité) ne dépend pas de
 * l'output de `update_pms`. Il est placé avant dans le flux et ne lit
 * que les données du trigger et de la classification — deux sources
 * disponibles même quand le PMS n'est pas configuré.
 *
 * Chemin nominal (PMS branché) :
 *   alert_manager | route_normal → out → update_pms → (terminé)
 *
 * Chemin dégradé (PMS non configuré, update_pms onError:skip) :
 *   alert_manager | route_normal → out → update_pms (skip)
 *   → out_pms_update_skipped (issue warning honnête)
 *
 * Supporté par executor.ts selectNextEdges :
 *   - stepFailed=true  → seules les edges condition==="error" sont empruntées
 *     (ligne 293-294) → out_pms_update_skipped atteint.
 *   - stepFailed=false → edges sans condition suivies → terminal (rien après
 *     update_pms succès, workflow_completed normalement).
 */

import type { WorkflowGraph } from "../../types";

export function serviceRequestDispatchTemplate(): WorkflowGraph {
  return {
    nodes: [
      {
        id: "trigger_webhook",
        kind: "trigger",
        label: "Webhook — service request",
        config: { mode: "webhook", path: "/hospitality/service-request" },
        position: { x: 80, y: 220 },
      },
      {
        id: "classify_priority",
        kind: "tool_call",
        label: "Classify priority (Haiku)",
        config: {
          tool: "ai_classify_priority",
          args: {
            text: "${trigger_webhook.text}",
            type: "${trigger_webhook.type}",
            categories: ["urgent", "normal", "low"],
            model: "claude-haiku-latest",
          },
        },
        position: { x: 320, y: 220 },
      },
      {
        id: "priority_check",
        kind: "condition",
        label: "Priorité = urgent ?",
        config: { expression: "classify_priority.priority == 'urgent'" },
        position: { x: 580, y: 220 },
      },
      {
        id: "alert_manager",
        kind: "tool_call",
        label: "Alert manager (Slack)",
        config: {
          tool: "slack_send_message",
          args: {
            channel: "#ops-manager",
            content:
              "URGENT — Room ${trigger_webhook.room} (${trigger_webhook.guestName}) : ${trigger_webhook.text}",
          },
        },
        position: { x: 840, y: 100 },
      },
      {
        id: "route_normal",
        kind: "tool_call",
        label: "Routing standard (Slack)",
        config: {
          tool: "slack_send_message",
          args: {
            channel: "#${trigger_webhook.type}",
            content:
              "Room ${trigger_webhook.room} (${trigger_webhook.guestName}) : ${trigger_webhook.text}",
          },
        },
        position: { x: 840, y: 340 },
      },
      // ── Asset ticket (TOUJOURS produit — dispatch réel confirmé) ──────────
      // Ne lit que trigger_webhook et classify_priority, disponibles
      // indépendamment du PMS. Placé avant update_pms pour garantir
      // l'émission du ticket même si la mise à jour PMS échoue.
      {
        id: "out",
        kind: "output",
        label: "Asset — Ticket service",
        config: {
          payload: {
            kind: "task",
            title: "Service request — ${trigger_webhook.type}",
            priority: "${classify_priority.priority}",
            room: "${trigger_webhook.room}",
            text: "${trigger_webhook.text}",
          },
        },
        position: { x: 1100, y: 220 },
      },
      // ── Update PMS (best-effort, skip si PMS non configuré) ───────────────
      {
        id: "update_pms",
        kind: "tool_call",
        label: "Update PMS status",
        config: {
          tool: "pms_update_request_status",
          args: {
            requestId: "${trigger_webhook.id}",
            status: "dispatched",
          },
        },
        onError: "skip",
        position: { x: 1360, y: 220 },
      },
      // ── Chemin d'erreur PMS ────────────────────────────────────────────────
      // Émis uniquement quand update_pms échoue (PMS non configuré).
      // Aucune donnée fictive — statut opérationnel explicite.
      // Calqué sur out_pms_missing de guest-arrival-prep pour cohérence.
      {
        id: "out_pms_update_skipped",
        kind: "output",
        label: "Statut PMS non mis à jour — PMS non configuré",
        config: {
          payload: {
            kind: "issue",
            severity: "warning",
            title: "Statut PMS non mis à jour — aucun connecteur PMS configuré",
            message:
              "Le ticket de service a bien été créé et le dispatch Slack a eu lieu. " +
              "La mise à jour du statut dans le PMS a échoué car aucun connecteur " +
              "PMS n'est configuré. Configurez un connecteur PMS dans les intégrations " +
              "pour activer la synchronisation automatique.",
          },
        },
        position: { x: 1620, y: 380 },
      },
    ],
    edges: [
      { id: "e1", source: "trigger_webhook", target: "classify_priority" },
      { id: "e2", source: "classify_priority", target: "priority_check" },
      {
        id: "e3",
        source: "priority_check",
        target: "alert_manager",
        condition: "true",
      },
      {
        id: "e4",
        source: "priority_check",
        target: "route_normal",
        condition: "false",
      },
      // Slack dispatch → ticket (toujours)
      { id: "e5", source: "alert_manager", target: "out" },
      { id: "e6", source: "route_normal", target: "out" },
      // Ticket → update PMS (best-effort)
      { id: "e7", source: "out", target: "update_pms" },
      // Chemin d'erreur PMS — emprunté par executor quand update_pms throw
      // (stepFailed=true → selectNextEdges retourne uniquement condition==="error")
      {
        id: "e_pms_error",
        source: "update_pms",
        target: "out_pms_update_skipped",
        condition: "error",
      },
    ],
    startNodeId: "trigger_webhook",
    version: 2,
  };
}
