"use client";

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

export function CockpitHeader() {
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(" ")[0] ?? "";
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const greeting = firstName ? `Bonjour, ${firstName}.` : "Bonjour.";

  return (
    <header className="flex flex-col gap-2 shrink-0">
      <div className="t-10 font-medium text-text-faint tabular-nums lowercase">
        {formatEyebrow(now)}
      </div>
      <h1
        className="t-48 font-extralight leading-[1.02] text-text-soft"
        style={{ letterSpacing: "var(--tracking-editorial)" }}
      >
        {greeting}
      </h1>
    </header>
  );
}
