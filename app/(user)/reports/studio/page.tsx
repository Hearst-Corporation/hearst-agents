export const dynamic = "force-dynamic";

import Link from "next/link";

const BLOCS = [
  { id: "kpi", icon: "◈", label: "KPI" },
  { id: "graph", icon: "◱", label: "Graphe" },
  { id: "table", icon: "▤", label: "Tableau" },
  { id: "text", icon: "¶", label: "Texte" },
  { id: "sep", icon: "—", label: "Séparateur" },
];

export default async function StudioPage() {
  return (
    <div className="h-screen w-full bg-(--ct-bg-deep) text-(--ct-text-strong) overflow-hidden flex flex-col">
      <div className="shrink-0 px-6 py-5 flex items-center gap-4 border-b border-(--ct-border-soft)">
        <Link
          href="/reports"
          className="t-13 text-(--ct-text-muted) hover:text-(--ct-text-body) transition-colors"
        >
          ← Rapports
        </Link>
        <span className="text-(--ct-border-strong)">/</span>
        <h1 className="t-20 font-semibold tracking-tight">Studio</h1>
      </div>

      <div className="flex-1 overflow-hidden flex gap-px">
        <div className="w-64 shrink-0 border-r border-(--ct-border-soft) overflow-y-auto p-4 flex flex-col gap-2">
          <p className="t-11 font-semibold uppercase tracking-(--tracking-eyebrow-soft) text-(--ct-text-muted) mb-2">
            Blocs
          </p>
          {BLOCS.map((b) => (
            <div
              key={b.id}
              className="flex items-center gap-3 px-3 py-2.5 bg-(--ct-surface-1) hover:bg-(--ct-surface-2) border border-(--ct-border-soft) rounded-(--radius-card) transition-colors"
            >
              <span className="text-(--ct-text-muted) t-15 w-5 text-center">{b.icon}</span>
              <span className="t-13 text-(--ct-text-body)">{b.label}</span>
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center">
          <div className="text-center">
            <p className="text-(--ct-text-muted) t-13">Glisse des blocs ici</p>
            <p className="text-(--text-faint) t-11 mt-1">Le rapport se construira en temps réel</p>
          </div>
        </div>

        <div className="w-64 shrink-0 border-l border-(--ct-border-soft) overflow-y-auto p-4 flex items-center justify-center">
          <p className="t-11 text-(--ct-text-muted) text-center leading-relaxed">
            Sélectionne un bloc
            <br />
            pour le configurer
          </p>
        </div>
      </div>
    </div>
  );
}
