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
    <div className="min-h-screen w-full bg-black text-white overflow-y-auto px-6 py-10">
      <div className="max-w-4xl mx-auto">
        <div className="mb-10">
          <h1 className="text-3xl font-semibold tracking-tight">Apps connectées</h1>
          <p className="mt-1 text-white/50 text-sm">
            Connecte les sources qui nourrissent tes missions
          </p>
        </div>

        <div className="mb-10">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-4">
            Connectées
          </h2>
          <div className="flex flex-col gap-3">
            {CONNECTED.map((app) => (
              <div
                key={app.id}
                className="flex items-center gap-4 bg-white/5 border border-emerald-500/30 rounded-2xl px-5 py-4"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold text-white shrink-0">
                  {app.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{app.name}</p>
                    <span className="text-xs px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
                      Connecté
                    </span>
                  </div>
                  <p className="text-xs text-white/40 mt-0.5">{app.description}</p>
                </div>
                <p className="text-xs text-white/25 shrink-0">depuis le {app.connectedAt}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-4">
            Disponibles
          </h2>
          <div className="grid grid-cols-3 gap-4">
            {AVAILABLE.map((app) => (
              <div
                key={app.id}
                className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col gap-3 hover:border-white/18 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold text-white">
                  {app.initials}
                </div>
                <div>
                  <p className="font-medium text-sm">{app.name}</p>
                  <p className="text-xs text-white/40 mt-0.5 leading-relaxed">{app.description}</p>
                </div>
                <button
                  type="button"
                  aria-label={`Connecter ${app.name}`}
                  className="mt-auto text-xs px-3 py-1.5 bg-white/8 hover:bg-white/12 border border-white/10 rounded-lg transition-colors self-start"
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
