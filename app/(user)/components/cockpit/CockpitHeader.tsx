"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import type { CockpitTodayPayload } from "@/lib/cockpit/today";

interface CockpitHeaderProps {
  data: CockpitTodayPayload;
}

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

export function CockpitHeader({ data }: CockpitHeaderProps) {
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(" ")[0] ?? "";
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const runningCount = data.missionsRunning.filter((m) => m.status === "running").length;
  const greeting = firstName ? `Bonjour, ${firstName}.` : "Bonjour.";

  return (
    <header className="flex flex-col gap-2 shrink-0">
      <div className="t-10 font-light text-[var(--text-faint)] tabular-nums lowercase">
        {formatEyebrow(now)}
      </div>
      <h1
        className="t-48 font-extralight leading-[1.02] text-[var(--text-soft)]"
        style={{ letterSpacing: "-0.035em" }}
      >
        {greeting}
        {runningCount > 0 && (
          <span className="t-15 font-light text-[var(--accent-teal)] ml-4 inline-flex items-center gap-2 align-middle">
            <span
              aria-hidden
              className="block w-1.5 h-1.5 rounded-full bg-[var(--accent-teal)] animate-pulse"
              style={{ boxShadow: "var(--shadow-pulse-dot)" }}
            />
            {runningCount} mission{runningCount > 1 ? "s" : ""} en cours
          </span>
        )}
      </h1>
    </header>
  );
}
