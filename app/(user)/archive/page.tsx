export const dynamic = "force-dynamic";

const tabs = ["Tout", "Threads", "Assets", "Missions"] as const;

export default async function ArchivePage() {
  return (
    <div className="min-h-screen w-full bg-black text-white overflow-y-auto px-6 py-10">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Archive</h1>
          <p className="mt-1 text-sm text-white/50">Threads et assets de plus de 7 jours</p>
        </div>

        <input
          type="search"
          aria-label="Rechercher dans l'archive"
          placeholder="Rechercher dans l'archive…"
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 w-full text-sm outline-none focus:border-white/30 transition-colors mb-6"
        />

        <div role="tablist" className="flex items-center gap-1 mb-8">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={tab === "Tout"}
              className={
                tab === "Tout"
                  ? "px-4 py-1.5 rounded-lg text-sm font-medium bg-white/10 text-white"
                  : "px-4 py-1.5 rounded-lg text-sm text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
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
            className="text-white/20"
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
          <p className="text-sm font-medium text-white/40">Aucun élément archivé</p>
          <p className="text-xs text-white/25">Les éléments de plus de 7 jours apparaîtront ici</p>
        </div>
      </div>
    </div>
  );
}
