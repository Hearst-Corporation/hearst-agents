import { type StageId, useStageStore } from "../stores/stage";

interface FooterContent {
  status: string;
  actions: string[];
  modes: [string, string];
}

const FOOTER_DATA: Record<StageId, FooterContent> = {
  home: {
    status: "Nominal",
    actions: ["Briefing", "Missions", "Rapports"],
    modes: ["Tout", "Runs"],
  },
  chat: {
    status: "Connecté",
    actions: ["Envoyer", "Fichier", "Contexte"],
    modes: ["Auto", "Manuel"],
  },
  mission: {
    status: "En cours",
    actions: ["Approuver", "Pause", "Annuler"],
    modes: ["Auto", "Pas-à-pas"],
  },
  asset: { status: "Chargé", actions: ["Ouvrir", "Comparer", "Partager"], modes: ["Vue", "Edit"] },
  browser: { status: "Live", actions: ["Piloter", "Capturer", "Stop"], modes: ["Auto", "Manuel"] },
  voice: {
    status: "Écoute active",
    actions: ["Muet", "Transférer", "Stop"],
    modes: ["Continu", "Push-to-talk"],
  },
  meeting: {
    status: "En réunion",
    actions: ["Notes", "Actions", "Quitter"],
    modes: ["Live", "Recap"],
  },
  artifact: {
    status: "Runtime prêt",
    actions: ["Exécuter", "Réinitialiser", "Exporter"],
    modes: ["Python", "Node"],
  },
  kg: { status: "Indexé", actions: ["Explorer", "Ajouter", "Export"], modes: ["Graph", "Liste"] },
  briefing: {
    status: "Généré",
    actions: ["Lire", "Résumer", "Archiver"],
    modes: ["Court", "Complet"],
  },
  rapport: {
    status: "Disponible",
    actions: ["Ouvrir", "Partager", "Archiver"],
    modes: ["Aperçu", "Complet"],
  },
  signal: {
    status: "2 alertes P0",
    actions: ["Voir", "Acquitter", "Ignorer"],
    modes: ["Temps réel", "Historique"],
  },
  apps: {
    status: "12 connectées",
    actions: ["Gérer", "Ajouter", "Tokens"],
    modes: ["Actives", "Toutes"],
  },
  charts: {
    status: "Live feed",
    actions: ["Détail", "Exporter", "Filtrer"],
    modes: ["Vue", "Données"],
  },
  "cockpit-legacy": {
    status: "Nominal",
    actions: ["Missions", "Logs", "Config"],
    modes: ["HUD", "Liste"],
  },
};

export function Footer() {
  const { current } = useStageStore();
  const data = FOOTER_DATA[current];

  return (
    <div
      style={{
        position: "absolute",
        bottom: 32,
        left: "50%",
        transform: "translateX(-50%) translateZ(20px)",
        display: "flex",
        alignItems: "center",
        gap: 48,
        padding: "14px 28px",
        borderRadius: 9999,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.12)",
        backdropFilter: "blur(60px) saturate(110%) brightness(105%)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -1px 0 rgba(0,0,0,0.5), 0 20px 60px -20px rgba(0,0,0,0.6)",
        zIndex: 20,
        whiteSpace: "nowrap",
      }}
    >
      {/* Zone 1 — Status */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "#5EE5C3",
            boxShadow: "0 0 6px #5EE5C3",
            animation: "pulse 2s infinite",
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontFamily: "monospace",
            fontSize: 11,
            color: "rgba(255,255,255,0.55)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          {data.status}
        </span>
      </div>

      {/* Zone 2 — Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {data.actions.map((label, i) => (
          <button
            key={label}
            style={{
              padding: "7px 16px",
              borderRadius: 9999,
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 150ms ease",
              outline: "none",
              ...(i === 0
                ? {
                    background: "#ffffff",
                    color: "#000",
                    border: "none",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,1), 0 4px 12px rgba(0,0,0,0.15)",
                  }
                : {
                    background: "rgba(255,255,255,0.05)",
                    color: "rgba(255,255,255,0.9)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    backdropFilter: "blur(20px)",
                  }),
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Zone 3 — Mode toggle */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          background: "rgba(0,0,0,0.2)",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.1)",
          borderRadius: 9999,
          padding: 3,
        }}
      >
        {data.modes.map((mode, i) => (
          <button
            key={mode}
            style={{
              padding: "5px 14px",
              borderRadius: 9999,
              fontSize: 11,
              fontWeight: 500,
              cursor: "pointer",
              border: "none",
              outline: "none",
              transition: "all 150ms ease",
              background: i === 0 ? "rgba(255,255,255,0.12)" : "transparent",
              color: i === 0 ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.45)",
            }}
          >
            {mode}
          </button>
        ))}
      </div>
    </div>
  );
}
