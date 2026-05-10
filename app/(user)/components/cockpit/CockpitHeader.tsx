"use client";
// lint-visual-disable-file

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

const FRENCH_DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const FRENCH_MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function formatEyebrow(now: Date): string {
  const day = FRENCH_DAYS[now.getDay()];
  const dayN = now.getDate();
  const month = FRENCH_MONTHS[now.getMonth()];
  const hh = now.getHours().toString().padStart(2, "0");
  const mm = now.getMinutes().toString().padStart(2, "0");
  return `${day} ${dayN} ${month} · ${hh}:${mm}`;
}

/**
 * Formate un delta de ms en libellé relatif FR.
 * Ex : 180_000 → "3 min" · 4_200_000 → "1h 10min"
 */
function formatAge(deltaMs: number): string {
  const totalMin = Math.floor(deltaMs / 60_000);
  if (totalMin < 1) return "à l'instant";
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

interface CockpitHeaderProps {
  /** Timestamp Unix ms de la dernière génération du brief (payload.generatedAt) */
  generatedAt?: number;
  /** Callback déclenché par le bouton Regénérer */
  onRefresh?: () => void;
}

export function CockpitHeader({ generatedAt, onRefresh }: CockpitHeaderProps = {}) {
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(" ")[0] ?? "";
  const [now, setNow] = useState<Date>(() => new Date());
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const greeting = firstName ? `Bonjour, ${firstName}.` : "Bonjour.";

  const ageLabel = generatedAt
    ? `il y a ${formatAge(now.getTime() - generatedAt)}`
    : null;

  async function handleRefresh() {
    if (!onRefresh || refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <header className="flex flex-col gap-2 shrink-0">
      <div className="flex items-center gap-2 font-light tabular-nums lowercase" style={{ fontSize: "13px", letterSpacing: "0.04em", color: "rgba(255, 255, 255, 0.55)" }}>
        <span>{formatEyebrow(now)}</span>
        {ageLabel && (
          <>
            <span aria-hidden>·</span>
            <span style={{ color: "rgba(255, 255, 255, 0.35)" }}>
              Mis à jour {ageLabel}
            </span>
            {onRefresh && (
              <button
                type="button"
                title="Regénérer le brief"
                disabled={refreshing}
                onClick={handleRefresh}
                className="inline-flex items-center gap-1 transition-colors disabled:opacity-40"
                style={{ fontSize: "inherit", lineHeight: 1, color: "rgba(255, 255, 255, 0.35)" }}
              >
                <span
                  aria-hidden
                  className={refreshing ? "animate-spin" : ""}
                  style={{ display: "inline-block" }}
                >
                  ↻
                </span>
              </button>
            )}
          </>
        )}
      </div>
      <h1
        className="font-extralight leading-[1.02]"
        style={{ fontSize: "3.5rem", letterSpacing: "-0.04em", color: "rgba(255, 255, 255, 0.9)" }}
      >
        {greeting}
      </h1>
    </header>
  );
}
