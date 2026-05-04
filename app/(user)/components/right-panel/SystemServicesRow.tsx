"use client";

/**
 * SystemServicesRow — Strate 1 du ContextRail (mode cockpit / chat).
 *
 * Affiche les services Composio sollicités récemment (dérivés des events SSE
 * `tool_call_*` du runtime store). Chaque service apparaît en fade-in + pulse
 * scale quand un tool_call arrive, et fade-out 30s plus tard sans nouvelle
 * activité.
 *
 * Implémentation pragmatique 2026-05-04 : rendu SVG/CSS plutôt que R3F.
 * Raison : `@react-three/fiber` n'est pas installé dans ce repo (la spec
 * cockpit v1.2 décrit un pivot 3D non encore implémenté). Une version
 * R3F équivalente reste un opt-in v2 si la lecture visuelle l'exige.
 *
 * Spec : [docs/screens/right-panel-dashboard.md](docs/screens/right-panel-dashboard.md) §5
 */

import { useEffect, useState } from "react";
import { useRuntimeStore } from "@/stores/runtime";
import {
  deriveActiveServicesFromEvents,
  type ActiveService,
} from "@/lib/cockpit/agents";

const REFRESH_INTERVAL_MS = 1_000;

const SERVICE_LABELS: Record<string, string> = {
  gmail: "Gmail",
  calendar: "Agenda",
  drive: "Drive",
  slack: "Slack",
  notion: "Notion",
  github: "GitHub",
  linear: "Linear",
  hubspot: "HubSpot",
  stripe: "Stripe",
};

function serviceInitial(id: string): string {
  return (SERVICE_LABELS[id] ?? id).slice(0, 1).toUpperCase();
}

function serviceLabel(id: string): string {
  return SERVICE_LABELS[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
}

export function SystemServicesRow() {
  const events = useRuntimeStore((s) => s.events);

  // Re-tick toutes les secondes pour que le fade-out après TTL soit fluide.
  // `now` est exposé en state plutôt qu'appelé pendant le rendu (purity).
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const activeServices = deriveActiveServicesFromEvents(events, now);

  return (
    <div
      className="flex items-center"
      style={{
        height: "var(--space-12)",
        gap: "var(--space-2)",
        padding: "0 var(--space-5)",
        borderBottom: "1px solid var(--border-subtle)",
        overflowX: "auto",
      }}
      aria-label="Services sollicités"
    >
      {activeServices.length === 0 ? (
        <span
          className="t-9 font-light"
          style={{ color: "var(--text-faint)" }}
        >
          Aucun service sollicité
        </span>
      ) : (
        activeServices.map((s) => (
          <ServiceChip key={s.id} service={s} now={now} />
        ))
      )}
    </div>
  );
}

function ServiceChip({ service, now }: { service: ActiveService; now: number }) {
  const ageMs = now - service.lastEventTs;
  const isFresh = ageMs < 1_500;
  return (
    <span
      className="inline-flex items-center shrink-0"
      style={{
        gap: "var(--space-2)",
        height: "var(--space-7)",
        padding: "0 var(--space-2)",
        borderRadius: "var(--radius-pill)",
        border: "1px solid var(--border-subtle)",
        background: "var(--surface-l1)",
        animation: isFresh ? "service-chip-pop 800ms ease-out" : undefined,
        transition: "opacity var(--duration-base) var(--ease-out)",
      }}
      title={`${serviceLabel(service.id)} · sollicité`}
    >
      <span
        aria-hidden
        className="t-9 font-medium tabular-nums flex items-center justify-center shrink-0"
        style={{
          width: "var(--space-5)",
          height: "var(--space-5)",
          borderRadius: "var(--radius-pill)",
          background: "var(--cykan)",
          color: "var(--text-on-cykan)",
        }}
      >
        {serviceInitial(service.id)}
      </span>
      <span
        className="t-9 font-light"
        style={{ color: "var(--text-l2)" }}
      >
        {serviceLabel(service.id)}
      </span>
    </span>
  );
}
