"use client";

import { useStageStore } from "@/stores/stage";
import { useRouter } from "next/navigation";

const ACTIONS = [
  { id: "brief", label: "Obtenir mon brief", mode: "chat" as const, href: null },
  { id: "data", label: "Analyser des données", mode: "chat" as const, href: null },
  { id: "doc", label: "Préparer un document", mode: "chat" as const, href: null },
  { id: "mission", label: "Lancer une mission", mode: null, href: "/missions/builder" },
  { id: "track", label: "Suivre mes missions", mode: null, href: "/missions" },
];

export function OrbitalQuickActions() {
  const setMode = useStageStore((s) => s.setMode);
  const router = useRouter();

  function handleClick(action: (typeof ACTIONS)[number]) {
    if (action.href) {
      router.push(action.href);
    } else if (action.mode) {
      setMode({ mode: action.mode });
    }
  }

  return (
    <div
      className="shrink-0 flex items-center justify-center flex-wrap"
      style={{
        gap: "var(--space-2)",
        padding: "0 var(--space-8) var(--space-8)",
      }}
    >
      {ACTIONS.map((action) => (
        <button
          key={action.id}
          type="button"
          onClick={() => handleClick(action)}
          style={{
            padding: "6px 14px",
            borderRadius: 100,
            fontSize: 12,
            fontWeight: 400,
            color: "var(--mono-text-35)",
            background: "transparent",
            border: "0.5px solid var(--mono-border)",
            cursor: "pointer",
            transition: "all 0.2s ease",
            letterSpacing: "0.01em",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--mono-text-70)";
            e.currentTarget.style.borderColor = "var(--mono-border-hover)";
            e.currentTarget.style.background = "var(--mono-surface)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--mono-text-35)";
            e.currentTarget.style.borderColor = "var(--mono-border)";
            e.currentTarget.style.background = "transparent";
          }}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
