"use client";
// lint-visual-disable-file

import Link from "next/link";
import { formatHHMM } from "@/lib/utils/date-format";
import type { CockpitTodayPayload } from "@/lib/cockpit/today";

interface TodayAgendaProps {
  data: CockpitTodayPayload;
}

const MAX_ITEMS = 5;

export function TodayAgenda({ data }: TodayAgendaProps) {
  const items = data.agenda.slice(0, MAX_ITEMS);
  const hasItems = items.length > 0;
  const connected = data.calendarConnected;

  return (
    <section className="flex flex-col min-h-0 min-w-0 mt-4" aria-label="Agenda du jour">
      <h2 
        className="font-light mb-4" 
        style={{ fontSize: "14px", color: "rgba(255, 255, 255, 0.8)" }}
      >
        Activité en temps réel
      </h2>
      {hasItems ? (
        <ul className="flex flex-col" style={{ gap: "4px" }}>
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-4 transition-colors duration-300"
              style={{
                padding: "8px 12px",
                borderRadius: "12px",
                background: "transparent",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <span
                className="flex items-center justify-center shrink-0"
                style={{ 
                  width: "28px", 
                  height: "28px", 
                  background: "rgba(255, 255, 255, 0.05)", 
                  borderRadius: "8px", 
                  color: "rgba(255, 255, 255, 0.8)",
                  fontSize: "14px"
                }}
                aria-hidden
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              </span>
              <span className="font-light truncate flex-1" style={{ fontSize: "14px", color: "rgba(255, 255, 255, 0.88)", letterSpacing: "0.02em" }}>
                {item.title}
              </span>
              <span className="font-light tabular-nums shrink-0" style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.35)" }}>
                {formatHHMM(item.startsAt)}
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
