"use client";

import type { TimelineItem, TimelineSeverity } from "@/lib/engine/runtime/timeline/types";

interface RunTimelineProps {
  timeline: TimelineItem[];
  isLive?: boolean;
}

const SEVERITY_STYLES: Record<TimelineSeverity, string> = {
  info: "text-text-muted",
  success: "text-(--money)",
  warning: "text-(--warn)",
  error: "text-(--danger)",
};

/** Badge de sévérité affiché à gauche de chaque ligne */
const SEVERITY_BADGE: Record<TimelineSeverity, string> = {
  info: "Info",
  success: "OK",
  warning: "Attn",
  error: "Err",
};

/** Labels FR naturels pour chaque type d'événement du run */
const TYPE_LABELS: Record<string, string> = {
  run_started: "Démarrage du run",
  run_completed: "Run terminé",
  run_failed: "Run échoué",
  execution_mode: "Mode d'exécution",
  agent_selected: "Agent sélectionné",
  provider_check: "Vérification du provider",
  capability_blocked: "Capacité bloquée",
  step_started: "Étape en cours",
  step_completed: "Étape terminée",
  step_failed: "Étape échouée",
  plan_step_started: "Étape en cours",
  plan_step_completed: "Étape terminée",
  plan_step_failed: "Étape échouée",
  asset_generated: "Asset généré",
  tool_call_started: "Outil appelé",
  tool_call_completed: "Outil terminé",
  tool_call_failed: "Outil en erreur",
  approval_required: "Validation requise",
  log: "Journal",
  message: "Message",
  error: "Erreur",
};

/** Labels FR pour les IDs de provider courants */
const PROVIDER_LABELS: Record<string, string> = {
  stripe: "Stripe",
  hubspot: "HubSpot",
  "google-calendar": "Google Calendar",
  google: "Google",
  gmail: "Gmail",
  slack: "Slack",
  notion: "Notion",
  airtable: "Airtable",
  linear: "Linear",
  github: "GitHub",
  openai: "OpenAI",
  anthropic: "Anthropic",
};

/**
 * Convertit un snake_case ou UPPER_CASE en libellé lisible.
 * Utilisé comme fallback quand le type n'est pas dans TYPE_LABELS.
 */
function humanizeType(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function RunTimeline({ timeline, isLive }: RunTimelineProps) {
  if (timeline.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-text-muted t-13 font-light">
        {isLive ? "En attente d'événements…" : "Aucun événement enregistré"}
      </div>
    );
  }

  return (
    <div className="divide-y divide-[var(--line)]">
      {timeline.map((item, index) => {
        const typeLabel = TYPE_LABELS[item.type] ?? humanizeType(item.type);
        const sevBadge = SEVERITY_BADGE[item.severity];
        const isLast = index === timeline.length - 1;
        const severityClass = SEVERITY_STYLES[item.severity];
        const providerLabel = item.provider
          ? (PROVIDER_LABELS[item.provider.toLowerCase()] ?? item.provider)
          : null;

        return (
          <div key={item.id} className={`flex items-start gap-4 py-3 px-2 ${isLast && isLive ? "bg-[var(--bg-soft)]" : ""}`}>
            <span className={`t-9 font-medium shrink-0 pt-0.5 border-b pb-0.5 ${severityClass} border-current`}>
              {sevBadge}
            </span>
            <div className="flex-1 min-w-0">
              <p className="t-9 font-medium text-text-faint mb-1">{typeLabel}</p>
              <p className={`t-13 font-light leading-snug ${severityClass}`}>{item.title}</p>
              {item.description && (
                <p className="t-11 text-text-muted truncate mt-1">{item.description}</p>
              )}
              {item.backend && (
                <p className="t-10 font-mono text-text-faint mt-1">{item.backend}</p>
              )}
              {providerLabel && (
                <p className="t-10 text-text-faint">via {providerLabel}</p>
              )}
              {item.assetName && (
                <p className="t-10 font-medium text-(--money) mt-1">{item.assetName}</p>
              )}
            </div>
            {isLast && isLive && <span className="w-1.5 h-1.5 shrink-0 mt-1 bg-(--accent-teal) animate-pulse" />}
          </div>
        );
      })}
    </div>
  );
}
