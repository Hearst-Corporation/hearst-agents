"use client";

import { SectionHeader } from "../ui/SectionHeader";
import { EmptyState } from "../ui/EmptyState";
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
      <SectionHeader label="Ton agent travaille" />
      {hasItems ? (
        <ul className="flex flex-col" style={{ gap: "var(--space-2)" }}>
          {items.map((item) => {
            const meta = STATUS_META[item.status];
            return (
              <li
                key={item.id}
                className="flex items-baseline gap-3"
                style={{
                  padding: "var(--space-2) var(--space-3)",
                  borderRadius: "var(--radius-xs)",
                }}
              >
                <span
                  className="t-13 shrink-0 font-mono"
                  style={{ color: meta.color, width: "1.2em" }}
                  aria-hidden
                >
                  {meta.glyph}
                </span>
                <span className="t-13 font-light text-(--text-l1) truncate flex-1">
                  {item.name}
                </span>
                {item.budgetUsd !== null && (
                  <MissionBudgetBadge
                    currentUsd={item.currentMonthUsd}
                    budgetUsd={item.budgetUsd}
                  />
                )}
                <span className="t-11 font-light text-text-faint shrink-0">
                  {meta.label}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          density="compact"
          title="Agent au repos"
          description="Aucune tâche en cours pour le moment."
          cta={{ label: "Lancer une mission →", href: "/missions" }}
        />
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
