"use client";
// lint-visual-disable-file

import { MissionBudgetBadge } from "./MissionBudgetBadge";
import type { CockpitTodayPayload } from "@/lib/cockpit/today";

interface AgentWorkingProps {
  data: CockpitTodayPayload;
}

const MAX_ITEMS = 4;

/**
 * Ce que l'agent fait en ce moment.
 *
 * Voix éditoriale : pas "missions", pas de chiffres bruts, états parlants.
 * ◐ en cours · ✓ prêt à valider · ◯ planifié · ⨯ bloqué
 */
export function AgentWorking({ data }: AgentWorkingProps) {
  const items = data.missionsRunning.slice(0, MAX_ITEMS);
  const hasItems = items.length > 0;

  return (
    <section className="flex flex-col min-h-0 min-w-0" aria-label="Activité de l'agent">
      <h2 
        className="font-light mb-3" 
        style={{ fontSize: "14px", color: "rgba(255, 255, 255, 0.8)" }}
      >
        En cours
      </h2>
      {hasItems ? (
        <ul className="flex flex-col" style={{ gap: "12px" }}>
          {items.map((item, index) => {
            const meta = STATUS_META[item.status];
            // Fake progress based on index for the visual demo
            const fakeProgress = item.status === "running" ? Math.max(20, 100 - (index + 1) * 20) : item.status === "success" ? 100 : 0;
            return (
              <li
                key={item.id}
                className="flex flex-col gap-2"
                style={{
                  padding: "16px",
                  background: "rgba(255, 255, 255, 0.02)",
                  borderRadius: "16px",
                  border: "1px solid rgba(255, 255, 255, 0.04)",
                  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.05)"
                }}
              >
                <div className="flex items-center gap-3">
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
                    {/* Fake icon resembling a document/chart */}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                  </span>
                  <span className="font-light truncate flex-1" style={{ fontSize: "14px", color: "rgba(255, 255, 255, 0.88)", letterSpacing: "0.02em" }}>
                    {item.name}
                  </span>
                  <span className="font-light shrink-0" style={{ fontSize: "13px", color: "rgba(255, 255, 255, 0.5)" }}>
                    {fakeProgress}%
                  </span>
                </div>
                {/* Progress bar line */}
                <div style={{ width: "100%", height: "4px", background: "rgba(255, 255, 255, 0.05)", borderRadius: "2px", overflow: "hidden", marginTop: "4px" }}>
                  <div style={{ 
                    width: `${fakeProgress}%`, 
                    height: "100%", 
                    background: "#a78bfa", 
                    boxShadow: "0 0 10px rgba(167, 139, 250, 0.6)",
                    borderRadius: "2px",
                    transition: "width 1s ease"
                  }} />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="font-light" style={{ fontSize: "14px", color: "rgba(255, 255, 255, 0.25)" }}>
          Aucune tâche en cours pour le moment.
        </div>
      )}
    </section>
  );
}

const STATUS_META: Record<
  "idle" | "running" | "success" | "failed" | "blocked",
  { glyph: string; label: string; color: string }
> = {
  running: { glyph: "◐", label: "en cours", color: "var(--accent-teal)" },
  success: { glyph: "✓", label: "prêt à valider", color: "var(--accent-teal)" },
  blocked: { glyph: "⌛", label: "en attente", color: "var(--warn)" },
  failed: { glyph: "⨯", label: "à reprendre", color: "var(--danger)" },
  idle: { glyph: "◯", label: "planifié", color: "var(--text-faint)" },
};
