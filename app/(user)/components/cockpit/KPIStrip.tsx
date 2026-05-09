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
      className="flex flex-col gap-2.5 cursor-pointer transition-transform duration-300 ease-out-soft hover:-translate-y-0.5 no-underline"
    >
      <span
        className="t-48 font-extralight text-[var(--text-l1)] leading-none tabular-nums"
        style={{ letterSpacing: "-0.03em" }}
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
 * Pivot v1.4 (silent luxury OS) : typographie 48px, gap 96px,
 * valeur + label seulement (deltas et sub-texts retirés).
 */
export function KPIStrip({ data }: KPIStripProps) {
  const assetsCount = data.counts.assets;
  const missionsTotal = data.counts.missions;
  const runningCount = data.missionsRunning.filter((m) => m.status === "running").length;
  const favCount = data.favoriteReports.length;

  return (
    <section
      className="flex flex-row items-end shrink-0"
      style={{ gap: "var(--space-24)" }}
      aria-label="Récap KPIs"
    >
      <Kpi
        value={assetsCount.toString().padStart(2, "0")}
        label="assets"
        href="/assets"
        testId="kpi-assets"
      />
      <Kpi
        value={
          <>
            {runningCount.toString().padStart(2, "0")}
            <span className="text-[var(--text-faint)] font-extralight" style={{ fontSize: "0.55em", marginLeft: "2px" }}>
              /{missionsTotal.toString().padStart(2, "0")}
            </span>
          </>
        }
        label="missions"
        href="/missions"
        testId="kpi-missions"
      />
      <Kpi
        value={favCount.toString().padStart(2, "0")}
        label="reports"
        href="/reports"
        testId="kpi-reports"
      />
    </section>
  );
}
