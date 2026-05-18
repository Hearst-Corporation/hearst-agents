import Link from "next/link";

export const dynamic = "force-dynamic";

type KindLabel = "workflow" | "rapport" | "persona";

interface Template {
  id: number;
  title: string;
  description: string;
  author: string;
  uses: number;
  kind: KindLabel;
}

const TEMPLATES: Template[] = [
  {
    id: 1,
    title: "Brief Rédactionnel Hebdo",
    description: "Génère le planning éditorial de la semaine depuis les trends.",
    author: "equipe-hearst",
    uses: 482,
    kind: "workflow",
  },
  {
    id: 2,
    title: "Rapport Performance Édition",
    description: "Consolide les KPIs d'une édition : vues, taux de rebond, RPM.",
    author: "analytics-lab",
    uses: 317,
    kind: "rapport",
  },
  {
    id: 3,
    title: "Persona Directeur Hôtel",
    description: "Agent spécialisé RevPAR, OCC, satisfaction client hôtellerie.",
    author: "hospitality-hub",
    uses: 204,
    kind: "persona",
  },
  {
    id: 4,
    title: "Veille Concurrents Médias",
    description: "Scrape et synthétise les publications concurrentes chaque matin.",
    author: "equipe-hearst",
    uses: 391,
    kind: "workflow",
  },
  {
    id: 5,
    title: "Rapport Audience Mensuel",
    description: "Tableau de bord audience : acquisition, rétention, géo.",
    author: "data-studio",
    uses: 158,
    kind: "rapport",
  },
  {
    id: 6,
    title: "Persona Journaliste Enquête",
    description: "Assiste la rédaction longue : vérification sources, angles narratifs.",
    author: "newsroom-ai",
    uses: 276,
    kind: "persona",
  },
];

const KIND_STYLES: Record<KindLabel, { badge: string; label: string }> = {
  workflow: { badge: "bg-blue-500/10 text-blue-400 border border-blue-500/20", label: "Workflow" },
  rapport: {
    badge: "bg-violet-500/10 text-violet-400 border border-violet-500/20",
    label: "Rapport",
  },
  persona: {
    badge: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    label: "Persona",
  },
};

export default async function MarketplacePage() {
  return (
    <div className="min-h-screen w-full bg-black text-white overflow-y-auto px-6 py-10">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 t-13 text-white/40 hover:text-white mb-4"
        >
          ← Cockpit
        </Link>
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Marketplace</h1>
          <p className="mt-1 text-white/50 text-sm">
            Templates communautaires · workflows, rapports, personas
          </p>
        </div>

        <div className="flex items-center gap-3 mb-8">
          <input
            type="text"
            placeholder="Rechercher un template…"
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/25 transition-colors"
            disabled
          />
          <div className="flex items-center gap-1">
            {(["Tout", "Workflow", "Rapport", "Persona"] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                className={`px-3.5 py-2 rounded-lg text-sm transition-colors ${
                  filter === "Tout"
                    ? "bg-white/10 text-white"
                    : "text-white/40 hover:text-white/70 hover:bg-white/5"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {TEMPLATES.map((t) => {
            const { badge, label } = KIND_STYLES[t.kind];
            return (
              <div
                key={t.id}
                className="bg-white/5 border border-white/8 rounded-2xl p-5 hover:border-white/15 transition-colors flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${badge}`}>
                    {label}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-sm leading-snug">{t.title}</p>
                  <p className="mt-1 text-white/45 text-xs leading-relaxed line-clamp-1">
                    {t.description}
                  </p>
                </div>
                <div className="flex items-center justify-between mt-auto pt-1">
                  <div className="text-xs text-white/30">
                    <span className="text-white/50">{t.author}</span>
                    <span className="mx-1.5">·</span>
                    <span>{t.uses.toLocaleString("fr-FR")} utilisations</span>
                  </div>
                  <button
                    type="button"
                    aria-label={`Installer ${t.title}`}
                    className="text-xs px-3 py-1.5 bg-white/8 hover:bg-white/12 border border-white/10 rounded-lg transition-colors"
                  >
                    Installer
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
