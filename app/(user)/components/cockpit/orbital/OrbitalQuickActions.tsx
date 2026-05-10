"use client";

import { useStageStore } from "@/stores/stage";
import { useRouter } from "next/navigation";

const ACTIONS = [
  { id: "brief",    label: "Obtenir mon brief",     mode: "chat" as const,    href: null },
  { id: "data",     label: "Analyser des données",   mode: "chat" as const,    href: null },
  { id: "doc",      label: "Préparer un document",   mode: "chat" as const,    href: null },
  { id: "mission",  label: "Lancer une mission",     mode: null,               href: "/missions/builder" },
  { id: "track",    label: "Suivre mes missions",    mode: null,               href: "/missions" },
];

export function OrbitalQuickActions() {
  const setMode = useStageStore((s) => s.setMode);
  const router = useRouter();

  function handleClick(action: typeof ACTIONS[number]) {
    if (action.href) {
      router.push(action.href);
    } else if (action.mode) {
      setMode({ mode: action.mode });
    }
  }

  return (
    <div
      className="shrink-0 flex items-center justify-center flex-wrap"
      style={{ gap: 8, padding: "0 48px 24px" }}
    >
      {ACTIONS.map((action) => (
        <button
          key={action.id}
          type="button"
          onClick={() => handleClick(action)}
          className="orbital-chip"
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
