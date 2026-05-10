"use client";

import Link from "next/link";
import { SectionHeader } from "../ui/SectionHeader";
import { EmptyState } from "../ui/EmptyState";
import type { CockpitTodayPayload } from "@/lib/cockpit/today";

interface WhenYouHave5MinProps {
  data: CockpitTodayPayload;
}

const MAX_ITEMS = 4;

interface SoftItem {
  id: string;
  title: string;
  href: string;
  hint?: string;
}

/**
 * "À regarder quand tu auras 5 min" — section apaisée qui fusionne
 * suggestions actionnables + reports favoris en une seule liste douce.
 *
 * Voix : pas d'urgence, pas de "PRIORITÉ", c'est du matériel pour les
 * micro-pauses de la journée.
 */
export function WhenYouHave5Min({ data }: WhenYouHave5MinProps) {
  const items = buildItems(data);
  const hasItems = items.length > 0;

  return (
    <section className="flex flex-col min-h-0 min-w-0" aria-label="À regarder plus tard">
      <SectionHeader label="À regarder quand tu auras 5 min" />
      {hasItems ? (
        <ul className="flex flex-col" style={{ gap: "var(--space-1)" }}>
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="flex items-baseline gap-3 group no-underline"
                style={{
                  padding: "var(--space-2) var(--space-3)",
                  borderRadius: "var(--radius-xs)",
                }}
              >
                <span className="t-13 text-[var(--text-faint)] shrink-0" aria-hidden>
                  →
                </span>
                <span className="t-13 font-light text-[var(--text-l1)] truncate group-hover:text-[var(--accent-teal)] transition-colors">
                  {item.title}
                </span>
                {item.hint && (
                  <span className="t-11 font-light text-[var(--text-faint)] shrink-0 ml-auto">
                    {item.hint}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          density="compact"
          title="Rien à signaler"
          description="Connecte tes apps pour activer les suggestions."
          cta={{ label: "Voir les apps →", href: "/apps" }}
        />
      )}
    </section>
  );
}

function buildItems(data: CockpitTodayPayload): SoftItem[] {
  const out: SoftItem[] = [];

  for (const sug of data.suggestions) {
    out.push({
      id: `sug-${sug.id}`,
      title: sug.title,
      href: `/reports/${sug.id}`,
      hint: sug.status === "partial" ? "à compléter" : undefined,
    });
  }

  for (const rep of data.favoriteReports) {
    if (out.some((x) => x.id === `rep-${rep.id}`)) continue;
    out.push({
      id: `rep-${rep.id}`,
      title: rep.title,
      href: `/reports/${rep.id}`,
    });
  }

  return out.slice(0, MAX_ITEMS);
}
