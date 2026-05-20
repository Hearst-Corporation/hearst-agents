import Link from "next/link";

export const dynamic = "force-dynamic";

const tabs = ["Tout", "Threads", "Assets", "Missions"] as const;

export default async function ArchivePage() {
  return (
    <div className="min-h-screen w-full bg-(--ct-bg-deep) text-(--ct-text-strong) overflow-y-auto px-6 py-10">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 t-13 text-(--ct-text-muted) hover:text-(--ct-text-strong) mb-4"
        >
          ← Cockpit
        </Link>
        <div className="mb-8">
          <h1 className="t-24 font-semibold tracking-tight">Archive</h1>
          <p className="mt-1 t-13 text-(--ct-text-muted)">Threads et assets de plus de 7 jours</p>
        </div>

        <input
          type="search"
          aria-label="Rechercher dans l'archive"
          placeholder="Recherche bientôt disponible"
          disabled
          aria-disabled="true"
          title="Recherche bientôt disponible"
          className="bg-(--ct-surface-1) border border-(--ct-border) rounded-(--radius-card) px-4 py-3 w-full t-13 outline-none focus:border-(--ct-border-strong) transition-colors mb-6"
        />

        <div role="tablist" className="flex items-center gap-1 mb-8">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={tab === "Tout"}
              disabled={tab !== "Tout"}
              aria-disabled={tab !== "Tout" ? "true" : undefined}
              title={tab !== "Tout" ? "À venir" : undefined}
              className={
                tab === "Tout"
                  ? "px-4 py-1.5 rounded-md t-13 font-medium bg-(--ct-surface-2) text-(--ct-text-strong)"
                  : "px-4 py-1.5 rounded-md t-13 text-(--ct-text-muted) hover:text-(--ct-text-body) hover:bg-(--ct-surface-1) transition-colors cursor-not-allowed"
              }
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
          <svg
            width="40"
            height="40"
            viewBox="0 0 40 40"
            fill="none"
            aria-hidden="true"
            className="text-(--ct-text-muted)"
          >
            <rect
              x="5"
              y="12"
              width="30"
              height="22"
              rx="2"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M5 18h30M15 24h10"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              d="M12 12V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
          <p className="t-13 font-medium text-(--ct-text-muted)">Aucun élément archivé</p>
          <p className="t-11 text-(--text-faint)">
            Les éléments de plus de 7 jours apparaîtront ici
          </p>
        </div>
      </div>
    </div>
  );
}
