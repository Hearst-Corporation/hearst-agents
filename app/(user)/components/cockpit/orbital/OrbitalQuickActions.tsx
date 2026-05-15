"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useStageStore } from "@/stores/stage";

const ACTIONS = [
  { id: "brief", label: "Obtenir mon brief", mode: "chat" as const, href: null },
  { id: "data", label: "Analyser des données", mode: "chat" as const, href: null },
  { id: "doc", label: "Préparer un document", mode: "chat" as const, href: null },
  { id: "mission", label: "Lancer une mission", mode: null, href: "/missions/builder" },
  { id: "track", label: "Suivre mes missions", mode: null, href: "/missions" },
];

function QuickActionButton({ label, onClick }: { label: string; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "6px 14px",
        borderRadius: "var(--radius-pill)",
        fontWeight: 400,
        color: hovered ? "var(--mono-text-70)" : "var(--mono-text-35)",
        background: hovered ? "var(--mono-surface)" : "transparent",
        border: `0.5px solid ${hovered ? "var(--mono-border-hover)" : "var(--mono-border)"}`,
        cursor: "pointer",
        transition: [
          "color var(--duration-base) var(--ease-standard)",
          "border-color var(--duration-base) var(--ease-standard)",
          "background-color var(--duration-base) var(--ease-standard)",
        ].join(", "),
        letterSpacing: "var(--tracking-hairline)",
        fontSize: "inherit",
      }}
    >
      {label}
    </button>
  );
}

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
        <QuickActionButton
          key={action.id}
          label={action.label}
          onClick={() => handleClick(action)}
        />
      ))}
    </div>
  );
}
