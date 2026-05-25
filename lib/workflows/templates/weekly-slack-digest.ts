/**
 * Template — Weekly Slack Digest.
 *
 * Cron vendredi 17h → agrégation activité semaine (`buildWeeklyDigest`)
 * → format Slack Block Kit (`formatWeeklyDigestBlocks`) → envoi via
 * `slack_send_message` (Composio).
 *
 * Le template expose le graphe code-as-data pour le Builder/Marketplace.
 * L'exécution réelle vit dans le job Inngest `weekly-digest` — c'est lui
 * qui orchestre l'agrégation côté serveur (le runner workflow ne sait pas
 * appeler `buildWeeklyDigest` directement, mais l'event Inngest peut).
 *
 * Configuration par défaut :
 *  - canal : `#hearst-digest`
 *  - timezone : `Europe/Paris`
 */

import type { WeeklyDigestPayload } from "@/lib/cockpit/weekly-digest";
import type { WorkflowGraph } from "../types";

export const WEEKLY_DIGEST_DEFAULT_CHANNEL = "#hearst-digest";
export const WEEKLY_DIGEST_DEFAULT_TZ = "Europe/Paris";
/** Cron Inngest — vendredi 17h Europe/Paris. */
const WEEKLY_DIGEST_CRON = "0 17 * * 5";

export interface WeeklyDigestTemplateOptions {
  channel?: string;
  timezone?: string;
}

export function weeklySlackDigestTemplate(
  options: WeeklyDigestTemplateOptions = {},
): WorkflowGraph {
  const channel = options.channel ?? WEEKLY_DIGEST_DEFAULT_CHANNEL;
  const timezone = options.timezone ?? WEEKLY_DIGEST_DEFAULT_TZ;

  return {
    nodes: [
      {
        id: "trigger_cron",
        kind: "trigger",
        label: "Vendredi 17h",
        config: {
          mode: "cron",
          cron: WEEKLY_DIGEST_CRON,
          timezone,
        },
        position: { x: 80, y: 220 },
      },
      {
        id: "aggregate_week",
        kind: "tool_call",
        label: "Agrégation semaine",
        config: {
          tool: "cockpit_build_weekly_digest",
          args: {
            // Résolu côté Inngest via le payload event.data.scope.
            userId: "${trigger_cron.userId}",
            tenantId: "${trigger_cron.tenantId}",
            workspaceId: "${trigger_cron.workspaceId}",
          },
        },
        position: { x: 320, y: 220 },
      },
      {
        id: "format_blocks",
        kind: "transform",
        label: "Format Slack Block Kit",
        config: {
          // Note : appliqué inline par le job Inngest pour rester
          // serializable côté workflow runner.
          formatter: "weekly_digest_block_kit",
        },
        position: { x: 580, y: 220 },
      },
      {
        id: "send_slack",
        kind: "tool_call",
        label: `Slack ${channel}`,
        config: {
          tool: "slack_send_message",
          args: {
            channel,
            content: "${format_blocks}",
          },
        },
        position: { x: 840, y: 220 },
      },
      {
        id: "out",
        kind: "output",
        label: "Asset — Weekly Digest",
        config: {
          payload: {
            kind: "report",
            title: "Weekly Slack Digest",
            channel,
            timezone,
          },
        },
        position: { x: 1100, y: 220 },
      },
    ],
    edges: [
      { id: "e1", source: "trigger_cron", target: "aggregate_week" },
      { id: "e2", source: "aggregate_week", target: "format_blocks" },
      { id: "e3", source: "format_blocks", target: "send_slack" },
      { id: "e4", source: "send_slack", target: "out" },
    ],
    startNodeId: "trigger_cron",
    version: 1,
  };
}

// ── Slack Block Kit formatter ────────────────────────────────

interface SlackTextBlock {
  type: "header" | "section" | "context" | "divider";
  text?: { type: "plain_text" | "mrkdwn"; text: string; emoji?: boolean };
  elements?: Array<{ type: "mrkdwn" | "plain_text"; text: string }>;
}

export interface WeeklyDigestSlackPayload {
  /** Texte fallback (notifications mobiles, clients sans Block Kit). */
  text: string;
  blocks: SlackTextBlock[];
}

const COCKPIT_URL = `${process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "https://hearst.app"}/cockpit`;
const MAX_MISSIONS_DISPLAYED = 5;

function formatCurrency(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0,00 $";
  return `${value.toFixed(2).replace(".", ",")} $`;
}

function fmtDate(ts: number, tz: string): string {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      timeZone: tz,
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
  }
}

/**
 * Formate un payload de digest hebdomadaire en Slack Block Kit.
 *
 * Sections :
 *  - Header : "Votre semaine sur Hearst OS — [période]"
 *  - Section 1 : missions completed (compteur + top 5 noms)
 *  - Section 2 : anomalies (narration courte)
 *  - Section 3 : top assets (3 max, avec liens)
 *  - Footer : "Voir plus dans votre cockpit →" + cumul runs/cost
 */
export function formatWeeklyDigestBlocks(
  payload: WeeklyDigestPayload,
  options: { timezone?: string } = {},
): WeeklyDigestSlackPayload {
  const tz = options.timezone ?? WEEKLY_DIGEST_DEFAULT_TZ;
  const blocks: SlackTextBlock[] = [];

  blocks.push({
    type: "header",
    text: {
      type: "plain_text",
      text: `Votre semaine sur Hearst OS — ${payload.window.label}`,
      emoji: false,
    },
  });

  // Section 1 — missions
  if (payload.missionsCompleted.length > 0) {
    const lines: string[] = [
      `*Missions exécutées* — ${payload.missionsCompleted.reduce(
        (acc, m) => acc + m.runs,
        0,
      )} runs sur ${payload.missionsCompleted.length} mission(s)`,
    ];
    for (const m of payload.missionsCompleted.slice(0, MAX_MISSIONS_DISPLAYED)) {
      lines.push(
        `• ${m.name} — ${m.successes}/${m.runs} succès (dernier run ${fmtDate(m.lastRunAt, tz)})`,
      );
    }
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: lines.join("\n") },
    });
  } else {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*Missions exécutées* — aucune mission lancée cette semaine.",
      },
    });
  }

  blocks.push({ type: "divider" });

  // Section 2 — anomalies
  if (payload.anomalies.length > 0) {
    const lines: string[] = [
      `*Anomalies* — ${payload.anomalies.length} run(s) en échec à inspecter`,
    ];
    for (const a of payload.anomalies) {
      const label = a.missionName ?? a.missionId ?? a.runId.slice(0, 8);
      lines.push(`• ${label} — ${a.error} (${fmtDate(a.failedAt, tz)})`);
    }
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: lines.join("\n") },
    });
  } else {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*Anomalies* — semaine clean, aucun run en échec.",
      },
    });
  }

  blocks.push({ type: "divider" });

  // Section 3 — top assets
  if (payload.topAssets.length > 0) {
    const lines: string[] = ["*Top assets* — ce que vous avez produit cette semaine"];
    for (const a of payload.topAssets) {
      const link = `${COCKPIT_URL}/assets/${a.id}`;
      lines.push(`• <${link}|${a.title}> — ${a.kind} (${fmtDate(a.createdAt, tz)})`);
    }
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: lines.join("\n") },
    });
  }

  // Best mission badge (optionnel)
  if (payload.bestMission && payload.bestMission.successes > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Best mission* — ${payload.bestMission.name} (${payload.bestMission.successes} succès)`,
      },
    });
  }

  blocks.push({ type: "divider" });

  // Footer — cumul + lien cockpit
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `${payload.totalRuns} runs · ${formatCurrency(payload.totalCostUsd)} · <${COCKPIT_URL}|Voir plus dans votre cockpit →>`,
      },
    ],
  });

  const fallbackText = `Hearst OS — semaine ${payload.window.label} : ${payload.totalRuns} runs, ${payload.missionsCompleted.length} missions, ${payload.anomalies.length} anomalies.`;

  return { text: fallbackText, blocks };
}
