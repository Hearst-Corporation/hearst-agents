"use client";
// lint-visual-disable-file

import Link from "next/link";
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
      <h2 
        className="font-light uppercase mb-3" 
        style={{ fontSize: "11px", letterSpacing: "0.08em", color: "rgba(255, 255, 255, 0.3)" }}
      >
        Aujourd&apos;hui
      </h2>
      {hasItems ? (
        <ul className="flex flex-col" style={{ gap: "6px" }}>
          {items.map((item) => (
            <li
              key={item.id}
              className="vision-list-item flex items-baseline gap-4"
              style={{
                padding: "8px 12px",
              }}
            >
              <span className="font-mono tabular-nums shrink-0" style={{ fontSize: "13px", color: "var(--accent-teal)" }}>
                {formatHHMM(item.startsAt)}
              </span>
              <span className="font-light truncate" style={{ fontSize: "15px", color: "rgba(255, 255, 255, 0.88)" }}>
                {item.title}
              </span>
            </li>
          ))}
        </ul>
      ) : connected ? (
        <div className="font-light" style={{ fontSize: "14px", color: "rgba(255, 255, 255, 0.25)" }}>
          Ta journée est libre.
        </div>
      ) : (
        <div className="font-light flex flex-col gap-2" style={{ fontSize: "14px", color: "rgba(255, 255, 255, 0.25)" }}>
          <span>Connecte Google Calendar pour voir ta journée.</span>
          <Link href="/apps#calendar" style={{ color: "rgba(255, 255, 255, 0.55)", textDecoration: "none" }}>Connecter le calendrier →</Link>
        </div>
      )}
    </section>
  );
}
