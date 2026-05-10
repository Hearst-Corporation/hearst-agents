"use client";
// lint-visual-disable-file

import Link from "next/link";
import type { CockpitTodayPayload } from "@/lib/cockpit/today";

interface WhenYouHave5MinProps {
  data: CockpitTodayPayload;
}

const MAX_ITEMS = 5;

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
    <section className="flex flex-col min-h-0 min-w-0 mt-4" aria-label="À regarder plus tard">
      <h2 
        className="font-light mb-4" 
        style={{ fontSize: "14px", color: "rgba(255, 255, 255, 0.8)" }}
      >
        À regarder quand tu auras 5 min
      </h2>
      {hasItems ? (
        <ul className="flex flex-col" style={{ gap: "4px" }}>
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="flex items-center gap-4 transition-colors duration-300 no-underline"
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
                <span className="font-light truncate transition-colors flex-1" style={{ fontSize: "14px", color: "rgba(255, 255, 255, 0.88)", letterSpacing: "0.02em" }}>
                  {item.title}
                </span>
                {item.hint ? (
                  <span className="font-light shrink-0 ml-auto" style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.35)" }}>
                    {item.hint}
                  </span>
                ) : (
                  <span className="font-light tabular-nums shrink-0 ml-auto" style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.35)" }}>
                    Hier
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
