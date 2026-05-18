export const dynamic = "force-dynamic";

const tabs = ["Tout", "Critique", "Alerte", "Info"] as const;

export default async function NotificationsPage() {
  return (
    <div className="min-h-screen w-full bg-black text-white overflow-y-auto px-6 py-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
            <p className="mt-1 text-sm text-white/50">Signaux, rapports, exports</p>
          </div>
          <button
            type="button"
            className="text-xs text-white/40 hover:text-white/70 transition-colors mt-1.5"
          >
            Tout marquer comme lu
          </button>
        </div>

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
            <path
              d="M20 6a10 10 0 0 1 10 10v6l3 4H7l3-4v-6A10 10 0 0 1 20 6z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M17 30a3 3 0 0 0 6 0"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <p className="text-sm font-medium text-white/40">Aucune notification</p>
          <p className="text-xs text-white/25">Tout est calme pour l'instant</p>
        </div>
      </div>
    </div>
  );
}
