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
    <div className="h-screen w-full bg-black text-white overflow-hidden flex flex-col">
      <div className="shrink-0 px-6 py-5 flex items-center gap-4 border-b border-white/8">
        <Link
          href="/reports"
          className="text-sm text-white/40 hover:text-white/70 transition-colors"
        >
          ← Rapports
        </Link>
        <span className="text-white/15">/</span>
        <h1 className="text-xl font-semibold tracking-tight">Studio</h1>
      </div>

      <div className="flex-1 overflow-hidden flex gap-px">
        <div className="w-64 shrink-0 border-r border-white/8 overflow-y-auto p-4 flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-2">
            Blocs
          </p>
          {BLOCS.map((b) => (
            <div
              key={b.id}
              className="flex items-center gap-3 px-3 py-2.5 bg-white/5 hover:bg-white/8 border border-white/8 rounded-xl transition-colors"
            >
              <span className="text-white/40 text-base w-5 text-center">{b.icon}</span>
              <span className="text-sm text-white/70">{b.label}</span>
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center">
          <div className="text-center">
            <p className="text-white/20 text-sm">Glisse des blocs ici</p>
            <p className="text-white/12 text-xs mt-1">Le rapport se construira en temps réel</p>
          </div>
        </div>

        <div className="w-64 shrink-0 border-l border-white/8 overflow-y-auto p-4 flex items-center justify-center">
          <p className="text-xs text-white/20 text-center leading-relaxed">
            Sélectionne un bloc
            <br />
            pour le configurer
          </p>
        </div>
      </div>
    </div>
  );
}
