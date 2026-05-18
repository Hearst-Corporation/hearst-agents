export const dynamic = "force-dynamic";

import Link from "next/link";

export default async function AlertingPage() {
  return (
    <div className="min-h-screen w-full bg-black text-white overflow-y-auto px-6 py-10">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors mb-8"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path
              d="M9 2L4 7l5 5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Réglages
        </Link>

        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Alerting</h1>
          <p className="mt-1 text-sm text-white/50">Seuils · Canaux · Règles</p>
        </div>

        <div className="flex flex-col gap-8">
          <section aria-labelledby="section-seuils">
            <h2
              id="section-seuils"
              className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-4"
            >
              Seuils
            </h2>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="threshold-critical" className="text-sm text-white/70">
                  Critique (%)
                </label>
                <input
                  id="threshold-critical"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={95}
                  className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-white/30 w-40 transition-colors"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="threshold-warning" className="text-sm text-white/70">
                  Avertissement (%)
                </label>
                <input
                  id="threshold-warning"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={80}
                  className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-white/30 w-40 transition-colors"
                />
              </div>
            </div>
          </section>

          <section aria-labelledby="section-canaux">
            <h2
              id="section-canaux"
              className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-4"
            >
              Canaux
            </h2>
            <div className="flex flex-col gap-3">
              {(["Email", "Slack", "Webhook"] as const).map((channel) => (
                <label key={channel} className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    name={`canal-${channel.toLowerCase()}`}
                    className="w-4 h-4 rounded bg-white/5 border border-white/10 accent-white cursor-pointer"
                  />
                  <span className="text-sm text-white/70 group-hover:text-white/90 transition-colors">
                    {channel}
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section aria-labelledby="section-regles">
            <h2
              id="section-regles"
              className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-4"
            >
              Règles
            </h2>
            <p className="text-sm text-white/30">Aucune règle configurée — bientôt disponible</p>
          </section>

          <div className="pt-2">
            <button
              type="button"
              className="px-6 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-sm font-medium transition-colors"
            >
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
