"use client";

import { useMemo } from "react";
import { useFocalStore } from "@/stores/focal";
import { useNavigationStore } from "@/stores/navigation";
import { BentoCard } from "./BentoCard";

interface BriefPanelProps {
  show: boolean;
}

/**
 * Brief — bento large (col 2 × row 2).
 *
 * Sources :
 *  - Focal store si type='brief' → affiche focal.title + focal.summary
 *  - Sinon : greeting éditorial (heure du prochain meeting + nb subjets actifs)
 */
export function BriefPanel({ show }: BriefPanelProps) {
  const focal = useFocalStore((s) => s.focal);
  const activeThreadId = useNavigationStore((s) => s.activeThreadId);
  const messages = useNavigationStore((s) =>
    activeThreadId ? s.messages[activeThreadId] : undefined,
  );

  const subjectsCount = useMemo(
    () => (messages ?? []).filter((m) => m.role === "user").length,
    [messages],
  );

  const timeString = useMemo(() => {
    const t = new Date();
    t.setHours(t.getHours() + 1);
    t.setMinutes(0);
    return t.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }, []);

  const isBriefFocal = focal?.type === "brief";
  const title = isBriefFocal ? focal.title : "Bonjour";
  const body = isBriefFocal
    ? (focal.summary ?? focal.body ?? "")
    : `Aujourd'hui, vous avez un meeting à ${timeString}. ${subjectsCount || 3} sujets demandent votre attention.`;

  const count = subjectsCount || (isBriefFocal ? 1 : 3);

  return (
    <BentoCard show={show} colSpan={2} rowSpan={2} delay={0.05}>
      <div className="flex h-full flex-col justify-between">
        <div>
          <div className="mb-2 text-spatial-xs font-semibold uppercase tracking-[0.2em] text-white/45">
            Brief
          </div>
          <div className="mb-3 text-spatial-3xl font-extralight tracking-tight text-white/95 line-clamp-2">
            {title}
          </div>
          <p className="text-spatial-base font-light leading-[1.65] text-white/70 line-clamp-4">
            {body}
          </p>
        </div>
        <div className="text-spatial-3xl font-light tracking-[-0.04em] text-white/95">
          {count.toString().padStart(2, "0")}
          <span className="ml-2 text-spatial-base font-light text-white/45">
            {isBriefFocal ? "brief actif" : "sujets"}
          </span>
        </div>
      </div>
      <div
        className="absolute right-7 top-7 h-2 w-2 rounded-full"
        style={{
          background: "rgba(255,255,255,0.85)",
          boxShadow: "0 0 12px rgba(255,255,255,0.6)",
        }}
      />
    </BentoCard>
  );
}
