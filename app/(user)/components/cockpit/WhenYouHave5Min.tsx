"use client";
// lint-visual-disable-file

import Link from "next/link";
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
      <h2 
        className="font-light uppercase mb-3" 
        style={{ fontSize: "11px", letterSpacing: "0.08em", color: "rgba(255, 255, 255, 0.3)" }}
      >
        À regarder quand tu auras 5 min
      </h2>
      {hasItems ? (
        <ul className="flex flex-col" style={{ gap: "6px" }}>
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="vision-list-item flex items-baseline gap-4 group no-underline"
                style={{
                  padding: "8px 12px",
                }}
              >
                <span className="shrink-0" style={{ fontSize: "13px", color: "rgba(255, 255, 255, 0.25)" }} aria-hidden>
                  →
                </span>
                <span className="font-light truncate transition-colors" style={{ fontSize: "15px", color: "rgba(255, 255, 255, 0.88)" }}>
                  {item.title}
                </span>
                {item.hint && (
                  <span className="font-light shrink-0 ml-auto" style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.35)" }}>
                    {item.hint}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="font-light" style={{ fontSize: "14px", color: "rgba(255, 255, 255, 0.25)" }}>
          Rien à signaler pour l&apos;instant.
        </div>
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
