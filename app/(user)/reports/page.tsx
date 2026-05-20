export const dynamic = "force-dynamic";

import Link from "next/link";

type StatusLabel = "publié" | "brouillon" | "archivé";
type DomainLabel = "Performance" | "Audience" | "Revenue" | "Hôtellerie";

interface Report {
  id: number;
  title: string;
  domain: DomainLabel;
  status: StatusLabel;
  updatedAt: string;
  authorInitials: string;
}

const REPORTS: Report[] = [
  {
    id: 1,
    title: "Performance Édition Printemps",
    domain: "Performance",
    status: "publié",
    updatedAt: "17 mai 2026",
    authorInitials: "AB",
  },
  {
    id: 2,
    title: "Audience Q1 2026",
    domain: "Audience",
    status: "publié",
    updatedAt: "14 mai 2026",
    authorInitials: "LC",
  },
  {
    id: 3,
    title: "Revenue Publicitaire Avril",
    domain: "Revenue",
    status: "brouillon",
    updatedAt: "10 mai 2026",
    authorInitials: "AB",
  },
  {
    id: 4,
    title: "RevPAR Semaine 20",
    domain: "Hôtellerie",
    status: "publié",
    updatedAt: "16 mai 2026",
    authorInitials: "MR",
  },
];

const STATUS_STYLES: Record<StatusLabel, string> = {
  /* TODO iter 2 : créer --color-success-* tokens — "publié" utilise --ct-accent-teal aligné DS Cockpit */
  publié: "bg-(--ct-surface-2) text-(--ct-accent-teal) border border-(--ct-border)",
  brouillon: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  archivé: "bg-(--ct-surface-1) text-(--ct-text-muted) border border-(--ct-border)",
};

const DOMAIN_STYLES: Record<DomainLabel, string> = {
  Performance: "text-blue-400",
  Audience: "text-violet-400",
  Revenue: "text-emerald-400",
  Hôtellerie: "text-amber-400",
};

const FILTERS = ["Tout", "Performance", "Audience", "Revenue", "Hôtellerie"] as const;

export default async function ReportsPage() {
  return (
    <div className="min-h-screen w-full bg-(--ct-bg-deep) text-(--ct-text-strong) overflow-y-auto px-6 py-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="t-30 font-semibold tracking-tight">Rapports</h1>
            <p className="mt-1 text-(--ct-text-muted) t-13">
              Bibliothèque · Analyse · Distributions
            </p>
          </div>
          {/* CTA primaire — sera remplacé par <Action variant="primary"> en iter 2 stream E */}
          <Link
            href="/reports/studio"
            className="flex items-center gap-1.5 px-4 py-2.5 bg-white text-black text-sm font-medium rounded-xl hover:bg-white/90 transition-colors"
          >
            Nouveau rapport →
          </Link>
        </div>

        <div className="flex items-center gap-1 mb-6">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              className={`px-3.5 py-2 rounded-md t-13 transition-colors ${
                f === "Tout"
                  ? "bg-(--ct-surface-2) text-(--ct-text-strong)"
                  : "text-(--ct-text-muted) hover:text-(--ct-text-body) hover:bg-(--ct-surface-1)"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {REPORTS.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-(--text-faint) t-13">
            Aucun rapport pour ce filtre
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {REPORTS.map((r) => (
              <div
                key={r.id}
                className="bg-(--ct-surface-1) border border-(--ct-border-soft) rounded-(--radius-card) p-5 hover:border-(--ct-border) transition-colors flex flex-col gap-3"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`t-11 px-2.5 py-1 rounded-full font-medium ${STATUS_STYLES[r.status]}`}
                  >
                    {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                  </span>
                  <div className="w-7 h-7 rounded-full bg-(--ct-surface-2) flex items-center justify-center t-11 font-semibold text-(--ct-text-body)">
                    {r.authorInitials}
                  </div>
                </div>
                <div>
                  <p className="font-medium t-13">{r.title}</p>
                  <p className={`t-11 mt-1 font-medium ${DOMAIN_STYLES[r.domain]}`}>{r.domain}</p>
                </div>
                <p className="t-11 text-(--ct-text-muted) mt-auto">Mis à jour le {r.updatedAt}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
