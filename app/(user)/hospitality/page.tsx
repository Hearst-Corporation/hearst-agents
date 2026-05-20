import Link from "next/link";

export const dynamic = "force-dynamic";

interface WorkflowCard {
  id: string;
  title: string;
  description: string;
}

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
    <div className="min-h-screen w-full bg-(--ct-bg-deep) text-(--ct-text-strong) overflow-y-auto px-6 py-10">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 t-13 text-(--ct-text-muted) hover:text-(--ct-text-strong) mb-4"
        >
          ← Cockpit
        </Link>
        <div className="bg-(--ct-surface-1) border border-(--ct-border) rounded-(--radius-card) px-4 py-3 mb-8 t-13 text-(--ct-text-muted)">
          Aucun connecteur PMS configuré — les indicateurs s'afficheront une fois un PMS (Mews /
          Cloudbeds / Opera) connecté.
        </div>

        <div className="mb-10">
          <h1 className="t-30 font-semibold tracking-tight">Hospitality</h1>
          <p className="mt-1 text-(--ct-text-muted) t-13">Cockpit vertical hôtellerie</p>
        </div>

        {/* KPI — empty state honnête, aucun chiffre fictif */}
        <div className="mb-10">
          <h2 className="t-11 font-semibold uppercase tracking-(--tracking-eyebrow-soft) text-(--ct-text-muted) mb-4">
            Indicateurs clés
          </h2>
          <div className="flex items-center justify-center bg-(--ct-surface-1) border border-(--ct-border-soft) rounded-(--radius-card) p-10 text-center">
            <div>
              <p className="t-13 font-medium text-(--ct-text-body)">Aucune donnée</p>
              <p className="t-11 text-(--ct-text-muted) mt-1 max-w-xs">
                Connectez un PMS pour afficher RevPAR, taux d'occupation et satisfaction client.
              </p>
            </div>
          </div>
        </div>

        {/* Workflows — capacités à venir, boutons désactivés proprement */}
        <div className="mb-10">
          <h2 className="t-11 font-semibold uppercase tracking-(--tracking-eyebrow-soft) text-(--ct-text-muted) mb-4">
            Workflows
          </h2>
          <div className="flex flex-col gap-3">
            {WORKFLOWS.map((w) => (
              <div
                key={w.id}
                className="flex items-center gap-5 bg-(--ct-surface-1) border border-(--ct-border-soft) rounded-(--radius-card) px-5 py-4"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium t-13">{w.title}</p>
                  <p className="t-11 text-(--ct-text-muted) mt-0.5 leading-relaxed">
                    {w.description}
                  </p>
                </div>
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  title="Bientôt disponible — nécessite un connecteur PMS"
                  className="shrink-0 t-11 px-4 py-2 bg-(--ct-surface-1) border border-(--ct-border) text-(--text-faint) rounded-(--radius-card) cursor-not-allowed"
                >
                  Bientôt disponible
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Persona — description des capacités, bouton désactivé */}
        <div>
          <h2 className="t-11 font-semibold uppercase tracking-(--tracking-eyebrow-soft) text-(--ct-text-muted) mb-4">
            Persona
          </h2>
          <div className="bg-(--ct-surface-1) border border-(--ct-border-soft) rounded-(--radius-card) p-6">
            <div className="flex items-center justify-between gap-6">
              <div>
                <p className="font-semibold t-15">Concierge IA</p>
                <p className="t-11 text-(--ct-text-muted) mt-0.5 font-medium">
                  Spécialisé hôtellerie
                </p>
                <p className="t-13 text-(--ct-text-body) mt-2 leading-relaxed max-w-lg">
                  Agent conversationnel entraîné sur les données hôtelières. Répond aux questions
                  sur les tarifs, disponibilités et packages. Adapte son ton au standing de
                  l'établissement.
                </p>
              </div>
              <button
                type="button"
                disabled
                aria-disabled="true"
                title="Bientôt disponible — nécessite un connecteur PMS"
                className="shrink-0 t-13 px-5 py-2.5 bg-(--ct-surface-1) border border-(--ct-border) text-(--text-faint) rounded-(--radius-card) cursor-not-allowed"
              >
                Bientôt disponible
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
