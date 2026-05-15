"use client";

import Link from "next/link";

type Tab = "productions" | "modeles";

interface LibraryTabsProps {
  active: Tab;
}

const TABS: { id: Tab; label: string; href: string; description: string }[] = [
  {
    id: "productions",
    label: "Productions",
    href: "/assets",
    description: "Briefs, rapports, documents générés par tes missions",
  },
  {
    id: "modeles",
    label: "Modèles",
    href: "/reports",
    description: "Modèles de rapports prêts à activer (catalogue)",
  },
];

export function LibraryTabs({ active }: LibraryTabsProps) {
  const current = TABS.find((t) => t.id === active);

  return (
    <div className="flex items-center justify-between w-full" style={{ gap: "var(--space-4)" }}>
      <div className="flex items-center" style={{ gap: "var(--space-1)" }}>
        {TABS.map((tab) => {
          const isActive = tab.id === active;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              data-active={isActive}
              className="t-13 font-medium transition-[background-color,color,border-color]"
              style={{
                padding: "var(--space-2) var(--space-3)",
                borderRadius: "var(--radius-md)",
                background: isActive ? "var(--accent-teal-bg-active)" : "transparent",
                color: isActive ? "var(--accent-teal)" : "var(--text-muted)",
                border: `1px solid ${isActive ? "var(--accent-teal-border)" : "transparent"}`,
                transitionDuration: "var(--duration-base)",
                transitionTimingFunction: "var(--ease-standard)",
              }}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
      {current?.description && (
        <p className="t-11 font-light text-text-faint hidden md:block">{current.description}</p>
      )}
    </div>
  );
}
