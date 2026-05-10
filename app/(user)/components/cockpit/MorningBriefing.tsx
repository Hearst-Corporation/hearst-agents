"use client";

import type { CockpitTodayPayload } from "@/lib/cockpit/today";

interface MorningBriefingProps {
  data: CockpitTodayPayload;
}

/**
 * Briefing du matin — narratif humain, 1 phrase d'ouverture + 3 bullets.
 *
 * Tire ses signaux du briefing (conversation-summary), de l'inbox,
 * de l'agenda et des missions pour produire un récap doux. Pas de
 * chiffres bruts, pas de jargon SaaS.
 */
export function MorningBriefing({ data }: MorningBriefingProps) {
  const bullets = buildBullets(data);
  const opener = buildOpener(data);

  return (
    <section
      className="flex flex-col shrink-0"
      style={{ gap: "var(--space-5)" }}
      aria-label="Briefing du matin"
    >
      <p
        className="t-28 font-extralight text-[var(--text-soft)]"
        style={{ letterSpacing: "-0.02em", lineHeight: "1.25" }}
      >
        {opener}
      </p>

      {bullets.length > 0 && (
        <ul className="flex flex-col" style={{ gap: "var(--space-2)" }}>
          {bullets.map((b, i) => (
            <li
              key={i}
              className="flex items-baseline gap-3 t-15 font-light text-[var(--text-l1)]"
            >
              <span className="text-[var(--text-faint)] shrink-0" aria-hidden>
                ─
              </span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function buildOpener(data: CockpitTodayPayload): string {
  if (!data.briefing.empty && data.briefing.headline) {
    return data.briefing.headline;
  }

  const totalSignals =
    data.missionsRunning.length +
    data.agenda.length +
    (data.inbox.brief?.items.length ?? 0);

  if (totalSignals === 0) {
    return "Journée calme. Profite-en.";
  }

  return "Voici ce qui se passe pour toi.";
}

function buildBullets(data: CockpitTodayPayload): string[] {
  const out: string[] = [];

  // 1. Mails à traiter
  const inboxCount = data.inbox.brief?.items.length ?? 0;
  if (inboxCount > 0) {
    if (inboxCount === 1) {
      out.push("1 mail attend une réponse rapide");
    } else {
      out.push(`${inboxCount} mails attendent une réponse rapide`);
    }
  }

  // 2. Prochain événement
  const nextEvent = data.agenda[0];
  if (nextEvent) {
    const time = formatTime(nextEvent.startsAt);
    out.push(`${nextEvent.title} à ${time}`);
  }

  // 3. Activité agent
  const running = data.missionsRunning.filter((m) => m.status === "running").length;
  const ready = data.missionsRunning.filter((m) => m.status === "success").length;
  if (running > 0 && ready > 0) {
    out.push(
      `Ton agent termine ${running} tâche${running > 1 ? "s" : ""}, ${ready} prête${ready > 1 ? "s" : ""} à valider`,
    );
  } else if (running > 0) {
    out.push(`Ton agent travaille sur ${running} tâche${running > 1 ? "s" : ""} en ce moment`);
  } else if (ready > 0) {
    out.push(`${ready} tâche${ready > 1 ? "s" : ""} prête${ready > 1 ? "s" : ""} à valider`);
  }

  return out.slice(0, 3);
}

function formatTime(ms: number): string {
  const d = new Date(ms);
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  return `${hh}h${mm === "00" ? "" : mm}`;
}
