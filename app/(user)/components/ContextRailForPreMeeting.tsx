"use client";

/**
 * ContextRailForPreMeeting — affiche le briefing pré-meeting (S3-A).
 *
 * Lit le payload depuis une notification `in_app_notifications` portant
 * `meta.subtype === "pre_meeting"`. Affiche :
 *   - Header : titre du meeting + eyebrow "Dans Xmin".
 *   - Liste des participants (max 3) avec kgSummary + lastInteraction.
 *   - Suggestion d'agenda (≤200 chars).
 *   - CTA "Ouvrir le meeting" → bascule sur le Stage `meeting` si possible.
 *
 * Utilisable :
 *   - En sub-rail standalone (slottable dans <ContextRail>).
 *   - En widget de drawer notifications (NotificationBell).
 */

import { useEffect, useMemo, useState } from "react";
import { useStageStore } from "@/stores/stage";
import { RailSection } from "./ui/RailSection";
import { EmptyState } from "./ui/EmptyState";
import { Action } from "./ui/Action";

// ── Types — alignés sur PreMeetingIntel côté serveur ─────────────

interface PreMeetingParticipantPayload {
  email: string;
  name: string | null;
  kgSummary: string | null;
  lastInteraction: { label: string; at: string } | null;
}

export interface PreMeetingNotificationMeta {
  subtype: "pre_meeting";
  eventId: string;
  startsAt: number;
  participants: PreMeetingParticipantPayload[];
  suggestedAgenda: string;
  generatedAt: number;
}

interface ContextRailForPreMeetingProps {
  eventTitle: string;
  meta: PreMeetingNotificationMeta;
}

// ── Helpers ──────────────────────────────────────────────────────

function formatMinutesUntil(startsAt: number, now: number): string {
  const diffMs = startsAt - now;
  if (diffMs <= 0) return "Maintenant";
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "Dans moins d'une minute";
  if (minutes === 1) return "Dans 1 minute";
  return `Dans ${minutes} minutes`;
}

/**
 * Tick toutes les 30s pour rafraîchir le compteur "Dans Xmin".
 * Initial state = 0 (rendu serveur stable) puis hydrate côté client.
 */
function useNowTick(intervalMs = 30_000): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydratation client après mount, puis tick périodique pour rafraîchir le compteur "Dans Xmin"
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function splitAgendaBullets(agenda: string): string[] {
  if (!agenda.trim()) return [];
  // Le prompt Haiku produit ' · ' comme séparateur, mais on accepte aussi
  // ';' et '·' nu pour rester tolérant.
  return agenda
    .split(/\s*[·;]\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 3);
}

// ── Composant ────────────────────────────────────────────────────

export function ContextRailForPreMeeting({
  eventTitle,
  meta,
}: ContextRailForPreMeetingProps) {
  const setMode = useStageStore((s) => s.setMode);
  const now = useNowTick();

  const eyebrow = useMemo(() => {
    if (now === 0) return "Pre-meeting"; // SSR/init state
    return formatMinutesUntil(meta.startsAt, now);
  }, [meta.startsAt, now]);
  const visibleParticipants = useMemo(
    () => meta.participants.slice(0, 3),
    [meta.participants],
  );
  const agendaBullets = useMemo(
    () => splitAgendaBullets(meta.suggestedAgenda),
    [meta.suggestedAgenda],
  );

  const handleOpenMeeting = () => {
    setMode({ mode: "meeting", meetingId: meta.eventId });
  };

  return (
    <div className="h-full overflow-y-auto" data-testid="context-rail-pre-meeting">
      {/* Header — eyebrow + titre */}
      <RailSection label="Pre-meeting">
        <p className="t-9 font-medium text-(--accent-teal) mb-2">{eyebrow}</p>
        <p
          className="t-15 font-light text-text-soft"
          style={{ lineHeight: "var(--leading-snug)" }}
        >
          {eventTitle}
        </p>
      </RailSection>

      {/* Participants */}
      <RailSection label="Participants" count={meta.participants.length}>
        {visibleParticipants.length === 0 ? (
          <EmptyState
            density="compact"
            title="Aucun participant"
            description="L'événement n'a pas d'invités identifiés."
          />
        ) : (
          <ul
            className="flex flex-col"
            style={{ gap: "var(--space-4)" }}
          >
            {visibleParticipants.map((p) => (
              <li
                key={p.email}
                className="border-l border-[var(--accent-teal-border)] pl-4 py-1"
              >
                <p className="t-13 font-light text-text-soft truncate">
                  {p.name ?? p.email}
                </p>
                {p.name && (
                  <p className="t-9 font-light text-text-faint truncate">
                    {p.email}
                  </p>
                )}
                {p.kgSummary && (
                  <p
                    className="t-11 font-light text-text-muted mt-2"
                    style={{ lineHeight: "var(--leading-relaxed)" }}
                  >
                    {p.kgSummary}
                  </p>
                )}
                {p.lastInteraction && (
                  <p className="t-9 font-medium text-text-ghost mt-1">
                    Dernier échange · {p.lastInteraction.label}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </RailSection>

      {/* Agenda suggéré */}
      <RailSection label="Agenda suggéré">
        {agendaBullets.length === 0 ? (
          <p className="t-11 font-light text-text-faint">
            Pas de suggestion — vérifie tes notes ou demande à l&apos;agent.
          </p>
        ) : (
          <ul
            className="flex flex-col"
            style={{ gap: "var(--space-2)" }}
          >
            {agendaBullets.map((bullet, i) => (
              <li
                key={i}
                className="flex items-baseline gap-3"
              >
                <span className="t-9 font-mono text-(--accent-teal) shrink-0">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p
                  className="t-13 font-light text-text-soft"
                  style={{ lineHeight: "var(--leading-relaxed)" }}
                >
                  {bullet}
                </p>
              </li>
            ))}
          </ul>
        )}
      </RailSection>

      {/* CTA */}
      <RailSection label="Action">
        <Action
          variant="secondary"
          tone="brand"
          size="md"
          onClick={handleOpenMeeting}
          testId="pre-meeting-open"
        >
          Ouvrir le meeting
        </Action>
      </RailSection>
    </div>
  );
}
