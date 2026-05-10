"use client";

import { SectionHeader } from "../ui/SectionHeader";
import { EmptyState } from "../ui/EmptyState";
import { formatHHMM } from "@/lib/utils/date-format";
import type { CockpitTodayPayload } from "@/lib/cockpit/today";

interface TodayAgendaProps {
  data: CockpitTodayPayload;
}

const MAX_ITEMS = 4;

export function TodayAgenda({ data }: TodayAgendaProps) {
  const items = data.agenda.slice(0, MAX_ITEMS);
  const hasItems = items.length > 0;
  const connected = data.calendarConnected;

  return (
    <section className="flex flex-col min-h-0 min-w-0" aria-label="Agenda du jour">
      <SectionHeader label="Aujourd'hui" />
      {hasItems ? (
        <ul className="flex flex-col" style={{ gap: "var(--space-2)" }}>
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-baseline gap-3"
              style={{
                padding: "var(--space-2) var(--space-3)",
                borderRadius: "var(--radius-xs)",
              }}
            >
              <span className="t-13 font-mono tabular-nums text-(--accent-teal) shrink-0">
                {formatHHMM(item.startsAt)}
              </span>
              <span className="t-13 font-light text-(--text-l1) truncate">
                {item.title}
              </span>
            </li>
          ))}
        </ul>
      ) : connected ? (
        <EmptyState
          density="compact"
          title="Rien de prévu"
          description="Ta journée est libre."
        />
      ) : (
        <EmptyState
          density="compact"
          title="Calendrier non connecté"
          description="Connecte Google Calendar pour voir ta journée."
          cta={{ label: "Connecter le calendrier →", href: "/apps#calendar" }}
        />
      )}
    </section>
  );
}
