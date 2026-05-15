import { type StageId, useStageStore } from "../stores/stage";

interface RailItem {
  label: string;
  sub: string;
  hot?: boolean;
}

interface RailContent {
  title: string;
  items: RailItem[];
}

const CONTENT: Record<StageId, RailContent> = {
  home: {
    title: "Ce soir",
    items: [
      { label: "Réunion 19h", sub: "Équipe produit · 45 min", hot: true },
      { label: "Brief demain 08h", sub: "Synthèse overnight agent" },
      { label: "Gmail — 5 drafts", sub: "En attente de validation" },
    ],
  },
  chat: {
    title: "Outils actifs",
    items: [
      { label: "gmail.search", sub: "Connecté · 12 appels", hot: true },
      { label: "kg.lookup", sub: "Connecté · 4 appels" },
    ],
  },
  mission: {
    title: "Mission active",
    items: [
      { label: "Gmail triage", sub: "En cours · 3 étapes restantes", hot: true },
      { label: "Approbation requise", sub: "Étape 4 · En attente" },
    ],
  },
  asset: {
    title: "Variants",
    items: [
      { label: "Vidéo v1", sub: "1080p · 2:34 · Draft", hot: true },
      { label: "Vidéo v2", sub: "1080p · 2:41 · Révisé" },
    ],
  },
  browser: {
    title: "Session live",
    items: [
      { label: "URL courante", sub: "app.hearst.ai/dashboard", hot: true },
      { label: "Dernier clic", sub: "Bouton « Lancer mission »" },
    ],
  },
  voice: {
    title: "Session voix",
    items: [
      { label: "WebRTC actif", sub: "Latence 12ms", hot: true },
      { label: "Transcript live", sub: "247 mots capturés" },
    ],
  },
  meeting: {
    title: "Réunion en cours",
    items: [
      { label: "Participants", sub: "3 connectés", hot: true },
      { label: "Action items", sub: "2 extraits jusqu'ici" },
    ],
  },
  artifact: {
    title: "Sandbox",
    items: [
      { label: "Runtime E2B", sub: "Python 3.11 · Actif", hot: true },
      { label: "Dernière exécution", sub: "Exit 0 · 0.3s" },
    ],
  },
  kg: {
    title: "Graphe",
    items: [
      { label: "Entités", sub: "1 243 nœuds", hot: true },
      { label: "Relations", sub: "3 891 arêtes" },
    ],
  },
  briefing: {
    title: "Briefing du jour",
    items: [
      { label: "Généré à 07h00", sub: "Agent overnight · 4 sources", hot: true },
      { label: "Points clés", sub: "5 items identifiés" },
    ],
  },
  rapport: {
    title: "Rapport",
    items: [
      { label: "Dernier rapport", sub: "Généré il y a 2h", hot: true },
      { label: "Statut", sub: "Validé · Partagé" },
    ],
  },
  signal: {
    title: "Signaux",
    items: [
      { label: "Alertes actives", sub: "2 P0 · 5 P1", hot: true },
      { label: "Dernier signal", sub: "Il y a 4 min" },
    ],
  },
  apps: {
    title: "Apps connectées",
    items: [
      { label: "Gmail", sub: "OAuth · Actif", hot: true },
      { label: "Composio", sub: "12 outils disponibles" },
    ],
  },
  charts: {
    title: "Data Viz",
    items: [
      { label: "Portefeuille", sub: "7.88B · 5 classes", hot: true },
      { label: "Performance", sub: "PRF-89 · Live feed" },
    ],
  },
  "cockpit-legacy": {
    title: "Cockpit",
    items: [
      { label: "Neural Engine", sub: "75% · Nominal", hot: true },
      { label: "Memory Buffer", sub: "32% · Stable" },
    ],
  },
};

export function RightRail() {
  const { current } = useStageStore();
  const content = CONTENT[current];

  return (
    <aside
      style={{
        width: 320,
        flexShrink: 0,
        borderLeft: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.02)",
        padding: "56px 32px",
        display: "flex",
        flexDirection: "column",
        zIndex: 10,
        overflowY: "auto",
      }}
    >
      <p
        style={{
          fontFamily: "monospace",
          fontSize: 10,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.35)",
          marginBottom: 8,
        }}
      >
        {current.toUpperCase()}
      </p>
      <h2
        style={{
          fontSize: 18,
          fontWeight: 500,
          color: "rgba(255,255,255,0.9)",
          marginBottom: 24,
          letterSpacing: "-0.02em",
        }}
      >
        {content.title}
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {content.items.map((item, i) => (
          <button
            key={i}
            style={{
              textAlign: "left",
              padding: "14px 16px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.08)",
              background: item.hot ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)",
              cursor: "pointer",
              transition: "background 150ms ease",
              outline: "none",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.07)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = item.hot
                ? "rgba(255,255,255,0.05)"
                : "rgba(255,255,255,0.02)";
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "rgba(255,255,255,0.88)",
                marginBottom: 3,
              }}
            >
              {item.label}
            </div>
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 10,
                color: "rgba(255,255,255,0.35)",
                letterSpacing: "0.05em",
              }}
            >
              {item.sub}
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}
