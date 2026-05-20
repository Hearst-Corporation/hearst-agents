export const dynamic = "force-dynamic";

const tabs = ["Tout", "Critique", "Alerte", "Info"] as const;

export default async function NotificationsPage() {
  return (
    <div className="min-h-screen w-full bg-(--ct-bg-deep) text-(--ct-text-strong) overflow-y-auto px-6 py-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="t-24 font-semibold tracking-tight">Notifications</h1>
            <p className="mt-1 t-13 text-(--ct-text-muted)">Signaux, rapports, exports</p>
          </div>
          <button
            type="button"
            disabled
            aria-disabled="true"
            title="À venir"
            className="t-11 text-(--ct-text-muted) hover:text-(--ct-text-body) transition-colors mt-1.5"
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
          <p className="t-13 font-medium text-(--ct-text-muted)">Aucune notification</p>
          <p className="t-11 text-(--text-faint)">Tout est calme pour l'instant</p>
        </div>
      </div>
    </div>
  );
}
