export const dynamic = "force-dynamic";

interface MetricCard {
  id: string;
  title: string;
  value: string;
  trend: string;
  positive: boolean;
}

interface WorkflowCard {
  id: string;
  title: string;
  description: string;
}

const METRICS: MetricCard[] = [
  {
    id: "revpar",
    title: "RevPAR hebdo",
    value: "148,50 €",
    trend: "+4,2 %",
    positive: true,
  },
  {
    id: "occ",
    title: "Taux d'occupation",
    value: "78 %",
    trend: "-1,5 %",
    positive: false,
  },
  {
    id: "sat",
    title: "Satisfaction client",
    value: "4,6 / 5",
    trend: "+0,3",
    positive: true,
  },
];

const WORKFLOWS: WorkflowCard[] = [
  {
    id: "checkin",
    title: "Check-in automatisé",
    description:
      "Envoie automatiquement les instructions d'arrivée 24h avant, adapte le message selon le profil.",
  },
  {
    id: "nuit",
    title: "Rapport nuit mensuel",
    description:
      "Consolide les données nuitées, incidents et taux d'occupation en un rapport PDF envoyé le 1er du mois.",
  },
];

export default async function HospitalityPage() {
  return (
    <div className="min-h-screen w-full bg-black text-white overflow-y-auto px-6 py-10">
      <div className="max-w-4xl mx-auto">
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 mb-8 text-sm text-amber-300/80">
          Mode démo · Connecteurs PMS bientôt disponibles. Données simulées.
        </div>

        <div className="mb-10">
          <h1 className="text-3xl font-semibold tracking-tight">Hospitality</h1>
          <p className="mt-1 text-white/50 text-sm">Cockpit vertical hôtellerie</p>
        </div>

        <div className="mb-10">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-4">
            Rapports recommandés
          </h2>
          <div className="flex gap-4">
            {METRICS.map((m) => (
              <div
                key={m.id}
                className="flex-1 bg-white/5 border border-white/8 rounded-2xl p-5 hover:border-white/15 transition-colors"
              >
                <p className="text-xs text-white/40 mb-2">{m.title}</p>
                <p className="text-2xl font-semibold text-amber-400">{m.value}</p>
                <p
                  className={`text-xs mt-1 font-medium ${
                    m.positive ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {m.trend} vs sem. précédente
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-10">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-4">
            Workflows
          </h2>
          <div className="flex flex-col gap-3">
            {WORKFLOWS.map((w) => (
              <div
                key={w.id}
                className="flex items-center gap-5 bg-white/5 border border-white/8 rounded-2xl px-5 py-4 hover:border-white/15 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{w.title}</p>
                  <p className="text-xs text-white/40 mt-0.5 leading-relaxed">{w.description}</p>
                </div>
                <button
                  type="button"
                  aria-label={`Activer ${w.title}`}
                  className="shrink-0 text-xs px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 rounded-xl transition-colors"
                >
                  Activer
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-4">
            Persona
          </h2>
          <div className="bg-white/5 border border-white/8 rounded-2xl p-6 hover:border-white/15 transition-colors">
            <div className="flex items-center justify-between gap-6">
              <div>
                <p className="font-semibold text-base">Concierge IA</p>
                <p className="text-xs text-amber-400 mt-0.5 font-medium">Spécialisé hôtellerie</p>
                <p className="text-sm text-white/45 mt-2 leading-relaxed max-w-lg">
                  Agent conversationnel entraîné sur les données hôtelières. Répond aux questions
                  sur les tarifs, disponibilités et packages. Adapte son ton au standing de
                  l'établissement.
                </p>
              </div>
              <button
                type="button"
                aria-label="Ouvrir Concierge IA"
                className="shrink-0 text-sm px-5 py-2.5 bg-white/10 hover:bg-white/15 border border-white/15 rounded-xl transition-colors"
              >
                Ouvrir
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
