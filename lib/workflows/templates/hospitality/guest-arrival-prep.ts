/**
 * Template hospitality — Préparation arrivées guests.
 * Cron 10h → fetch arrivals today → filtre VIP → génère welcome notes
 * personnalisés (Claude) → envoi Slack staff → approval gate → asset.
 *
 * Chemin d'erreur PMS (fetch_arrivals échoue) :
 *   edge condition:"error" → out_pms_missing (output terminal honnête,
 *   aucune donnée fictive, aucun chiffre d'arrivées).
 *   Supporté par executor.ts selectNextEdges : si stepFailed, seules les
 *   edges condition==="error" sont empruntées (lignes 291-295).
 */

import type { WorkflowGraph } from "../../types";

export function guestArrivalPrepTemplate(): WorkflowGraph {
  return {
    nodes: [
      {
        id: "trigger_cron",
        kind: "trigger",
        label: "Tous les jours à 10h",
        config: { mode: "cron", cron: "0 10 * * *" },
        position: { x: 80, y: 200 },
      },
      {
        id: "fetch_arrivals",
        kind: "tool_call",
        label: "Arrivées du jour (PMS)",
        config: {
          tool: "pms_list_arrivals_today",
          args: { date: "${trigger_cron.date}", includeRequests: true },
        },
        onError: "skip",
        position: { x: 320, y: 200 },
      },
      // ── Chemin nominal (PMS connecté) ──────────────────────────────────
      {
        id: "filter_vip",
        kind: "transform",
        label: "Filtre VIP",
        config: { expression: "fetch_arrivals.filter(a => a.vip === true)" },
        position: { x: 580, y: 200 },
      },
      {
        id: "draft_welcome_notes",
        kind: "tool_call",
        label: "Generate welcome notes (Claude)",
        config: {
          tool: "ai_draft_welcome_notes",
          args: {
            arrivals: "${filter_vip}",
            tone: "warm-professional",
            includeRoomNumber: true,
          },
        },
        position: { x: 840, y: 200 },
      },
      {
        id: "approval_send",
        kind: "approval",
        label: "Validation notes VIP",
        config: {
          preview: "Envoyer ${filter_vip.length} welcome notes VIP au staff frontdesk ?",
        },
        position: { x: 1100, y: 200 },
      },
      {
        id: "send_slack",
        kind: "tool_call",
        label: "Slack #frontdesk",
        config: {
          tool: "slack_send_message",
          args: {
            channel: "#frontdesk",
            content: "${draft_welcome_notes}",
          },
        },
        position: { x: 1360, y: 200 },
      },
      {
        id: "out",
        kind: "output",
        label: "Asset — VIP arrivals brief",
        config: {
          payload: {
            kind: "report",
            title: "VIP arrivals — welcome brief",
            content: "${draft_welcome_notes}",
            count: "${filter_vip.length}",
          },
        },
        position: { x: 1620, y: 200 },
      },
      // ── Chemin d'erreur PMS (fetch_arrivals skipped) ───────────────────
      // Émis uniquement quand le connecteur PMS n'est pas configuré.
      // Aucune donnée d'arrivée, aucun chiffre fictif — statut opérationnel
      // explicite pour que l'absence de brief reste visible et traçable.
      {
        id: "out_pms_missing",
        kind: "output",
        label: "Brief non généré — PMS non configuré",
        config: {
          payload: {
            kind: "issue",
            title: "Brief VIP non généré — aucun connecteur PMS configuré",
            severity: "warning",
            message:
              "Le workflow de préparation arrivées n'a pas pu récupérer les données du PMS. " +
              "Configurez un connecteur PMS dans les intégrations pour activer ce brief.",
          },
        },
        position: { x: 580, y: 400 },
      },
    ],
    edges: [
      // Chemin nominal
      { id: "e1", source: "trigger_cron", target: "fetch_arrivals" },
      { id: "e2", source: "fetch_arrivals", target: "filter_vip" },
      { id: "e3", source: "filter_vip", target: "draft_welcome_notes" },
      { id: "e4", source: "draft_welcome_notes", target: "approval_send" },
      { id: "e5", source: "approval_send", target: "send_slack" },
      { id: "e6", source: "send_slack", target: "out" },
      // Chemin d'erreur PMS — emprunté par executor quand fetch_arrivals throw
      // (stepFailed=true → selectNextEdges retourne uniquement condition==="error")
      {
        id: "e_pms_error",
        source: "fetch_arrivals",
        target: "out_pms_missing",
        condition: "error",
      },
    ],
    startNodeId: "trigger_cron",
    version: 2,
  };
}
