"use client";

import Link from "next/link";
import type { CockpitTodayPayload } from "@/lib/cockpit/today";

interface KPIStripProps {
  data: CockpitTodayPayload;
}

interface KpiProps {
  value: React.ReactNode;
  label: string;
  href: string;
  testId: string;
}

function Kpi({ value, label, href, testId }: KpiProps) {
  return (
    <Link
      href={href}
      data-testid={testId}
      className="flex flex-col gap-2.5 cursor-pointer transition-transform duration-300 ease-out-soft hover:-translate-y-0.5 active:scale-[0.98] active:duration-100 no-underline"
    >
      <span
        className="t-30 font-extralight text-[var(--text-soft)] leading-none tabular-nums"
        style={{ letterSpacing: "-0.025em" }}
      >
        {value}
      </span>
      <span
        className="t-11 font-light text-[var(--text-faint)] lowercase"
        style={{ letterSpacing: "0.04em" }}
      >
        {label}
      </span>
    </Link>
  );
}

/**
 * KPIs flottants — intégrés à l'atmosphère cockpit, pas en card.
 * Pivot v1.4 (silent luxury OS) : valeur + label seulement.
 * Hero typographique (t-30) descendu sous le greeting (t-48) pour
 * laisser le H1 « Bonjour » dominer en first-read — cascade Apple HIG.
 */
export function KPIStrip({ data }: KPIStripProps) {
  const assetsCount = data.counts.assets;
  const missionsTotal = data.counts.missions;
  const runningCount = data.missionsRunning.filter((m) => m.status === "running").length;
  const favCount = data.favoriteReports.length;

  // Format missions : si rien ne tourne, on n'affiche que le total.
  // Le ratio 0/6 dilue le hero quand l'état est idle.
  const missionsValue =
    runningCount > 0 ? (
      <>
        {runningCount}
        <span
          className="text-[var(--text-faint)] font-extralight"
          style={{ fontSize: "0.55em", marginLeft: "2px" }}
        >
          /{missionsTotal}
        </span>
      </>
    ) : (
      missionsTotal
    );

  return (
    <section
      className="flex flex-row items-end shrink-0"
      style={{ gap: "var(--space-16)" }}
      aria-label="Récap KPIs"
    >
      <Kpi value={assetsCount} label="assets" href="/assets" testId="kpi-assets" />
      <Kpi value={missionsValue} label="missions" href="/missions" testId="kpi-missions" />
      <Kpi value={favCount} label="reports" href="/reports" testId="kpi-reports" />
    </section>
  );
}
