export const dynamic = "force-dynamic";

interface ConnectedApp {
  id: string;
  name: string;
  description: string;
  initials: string;
  connectedAt: string;
}

interface AvailableApp {
  id: string;
  name: string;
  description: string;
  initials: string;
}

const CONNECTED: ConnectedApp[] = [
  {
    id: "slack",
    name: "Slack",
    description: "Notifications et résumés de missions dans tes channels.",
    initials: "SL",
    connectedAt: "12 mai 2026",
  },
  {
    id: "gdrive",
    name: "Google Drive",
    description: "Accès aux documents partagés pour alimenter les rapports.",
    initials: "GD",
    connectedAt: "8 mai 2026",
  },
];

const AVAILABLE: AvailableApp[] = [
  {
    id: "ga",
    name: "Google Analytics",
    description: "Audience, sessions, conversions en temps réel.",
    initials: "GA",
  },
  {
    id: "hubspot",
    name: "HubSpot",
    description: "CRM, deals pipeline et suivi leads éditoriaux.",
    initials: "HS",
  },
  {
    id: "airtable",
    name: "Airtable",
    description: "Bases de données éditoriales, plannings et trackers.",
    initials: "AT",
  },
  {
    id: "notion",
    name: "Notion",
    description: "Wikis, briefs et documentations d'équipe.",
    initials: "NO",
  },
  {
    id: "zapier",
    name: "Zapier",
    description: "Automatisations entre apps sans code.",
    initials: "ZP",
  },
  {
    id: "pms",
    name: "PMS Hôtellerie",
    description: "Données de réservation, RevPAR et occupation temps réel.",
    initials: "PM",
  },
];

export default async function AppsPage() {
  return (
    <div className="min-h-screen w-full bg-(--ct-bg-deep) text-(--ct-text-strong) overflow-y-auto px-6 py-10">
      <div className="max-w-4xl mx-auto">
        <div className="mb-10">
          <h1 className="t-30 font-semibold tracking-tight">Apps connectées</h1>
          <p className="mt-1 text-(--ct-text-muted) t-13">
            Connecte les sources qui nourrissent tes missions
          </p>
        </div>

        <div className="mb-10">
          <h2 className="t-11 font-semibold uppercase tracking-(--tracking-eyebrow-soft) text-(--ct-text-muted) mb-4">
            Connectées
          </h2>
          <div className="flex flex-col gap-3">
            {CONNECTED.map((app) => (
              <div
                key={app.id}
                className="flex items-center gap-4 bg-(--ct-surface-1) border border-(--ct-border) rounded-(--radius-card) px-5 py-4"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center t-11 font-bold text-(--ct-text-strong) shrink-0">
                  {app.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium t-13">{app.name}</p>
                    {/* TODO iter 2 : créer --color-success-* tokens — badge "Connecté" utilise --ct-accent-teal aligné DS Cockpit */}
                    <span className="t-11 px-2 py-0.5 bg-(--ct-surface-2) text-(--ct-accent-teal) border border-(--ct-border) rounded-full">
                      Connecté
                    </span>
                  </div>
                  <p className="t-11 text-(--ct-text-muted) mt-0.5">{app.description}</p>
                </div>
                <p className="t-11 text-(--text-faint) shrink-0">depuis le {app.connectedAt}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="t-11 font-semibold uppercase tracking-(--tracking-eyebrow-soft) text-(--ct-text-muted) mb-4">
            Disponibles
          </h2>
          <div className="grid grid-cols-3 gap-4">
            {AVAILABLE.map((app) => (
              <div
                key={app.id}
                className="bg-(--ct-surface-1) border border-(--ct-border) rounded-(--radius-card) p-5 flex flex-col gap-3 hover:border-(--ct-border-strong) transition-colors"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center t-11 font-bold text-(--ct-text-strong)">
                  {app.initials}
                </div>
                <div>
                  <p className="font-medium t-13">{app.name}</p>
                  <p className="t-11 text-(--ct-text-muted) mt-0.5 leading-relaxed">
                    {app.description}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Connecter ${app.name}`}
                  className="mt-auto t-11 px-3 py-1.5 bg-(--ct-surface-2) hover:bg-(--ct-surface-3) border border-(--ct-border) rounded-md transition-colors self-start"
                >
                  Connecter
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
