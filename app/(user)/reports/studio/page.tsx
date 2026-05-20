"use client";

import Link from "next/link";
import { StandalonePageFrame } from "@/app/(user)/components/standalone/StandalonePageFrame";
import { EmptyState, SectionEyebrow } from "@/app/(user)/components/ui";

const BLOCS = [
  { id: "kpi", icon: "◈", label: "KPI" },
  { id: "graph", icon: "◱", label: "Graphe" },
  { id: "table", icon: "▤", label: "Tableau" },
  { id: "text", icon: "¶", label: "Texte" },
  { id: "sep", icon: "—", label: "Séparateur" },
];

export default function StudioPage() {
  return (
    <StandalonePageFrame>
      <div
        className="flex h-full min-h-0 flex-col overflow-hidden"
        style={{ background: "var(--surface)" }}
      >
        <header
          className="shrink-0 flex items-center border-b border-(--border-shell)"
          style={{ gap: "var(--space-4)", padding: "var(--space-5) var(--space-6)" }}
        >
          <Link
            href="/reports"
            className="t-13 font-light text-text-faint hover:text-(--accent-teal) transition-colors"
          >
            ← Rapports
          </Link>
          <span className="text-text-ghost" aria-hidden>
            /
          </span>
          <h1 className="t-20 font-medium tracking-tight text-text">Studio</h1>
        </header>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          <aside
            className="shrink-0 border-r border-(--border-shell) overflow-y-auto"
            style={{ width: "var(--width-admin-sidebar)", padding: "var(--space-4)" }}
          >
            <SectionEyebrow id="blocs" className="!mb-2">
              Blocs
            </SectionEyebrow>
            <div className="flex flex-col" style={{ gap: "var(--space-2)" }}>
              {BLOCS.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center rounded-xl border border-(--border-shell) bg-(--surface-1) hover:bg-(--surface-2) transition-colors cursor-default"
                  style={{ gap: "var(--space-3)", padding: "var(--space-2-5) var(--space-3)" }}
                >
                  <span className="t-15 text-text-faint w-5 text-center" aria-hidden>
                    {b.icon}
                  </span>
                  <span className="t-13 font-light text-text-muted">{b.label}</span>
                </div>
              ))}
            </div>
          </aside>

          <main
            className="flex-1 overflow-y-auto flex flex-col items-center justify-center"
            style={{ padding: "var(--space-6)" }}
          >
            <EmptyState
              title="Glisse des blocs ici"
              description="Le rapport se construira en temps réel"
            />
          </main>

          <aside
            className="shrink-0 border-l border-(--border-shell) overflow-y-auto flex items-center justify-center"
            style={{ width: "var(--width-admin-sidebar)", padding: "var(--space-4)" }}
          >
            <p className="t-11 font-light text-text-ghost text-center leading-relaxed">
              Sélectionne un bloc
              <br />
              pour le configurer
            </p>
          </aside>
        </div>
      </div>
    </StandalonePageFrame>
  );
}
