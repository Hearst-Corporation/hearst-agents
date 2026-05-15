import { motion } from "framer-motion";
import { useStageStore } from "../stores/stage";

const today = new Date().toLocaleDateString("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

const ACTIVITY = [
  {
    id: "MSN-041",
    label: "Analyse pipeline LLM — cluster Production",
    status: "En cours",
    stage: "mission" as const,
  },
  {
    id: "MSN-038",
    label: "Rotation des clés API Composio",
    status: "Terminé",
    stage: "mission" as const,
  },
  {
    id: "RPT-012",
    label: "Rapport de synthèse hebdomadaire",
    status: "Prêt",
    stage: "rapport" as const,
  },
  {
    id: "AST-007",
    label: "Campagne email Q2 — 3 assets vidéo",
    status: "Draft",
    stage: "asset" as const,
  },
  {
    id: "SIG-003",
    label: "Pic trafic détecté — latence API +40%",
    status: "Alerte",
    stage: "signal" as const,
  },
];

const STATUS_COLOR: Record<string, string> = {
  "En cours": "#4A8B86",
  Terminé: "rgba(255,255,255,0.35)",
  Prêt: "#5EE5C3",
  Draft: "rgba(255,255,255,0.45)",
  Alerte: "#ff6b6b",
};

export function HomeStage() {
  const { setStage } = useStageStore();

  return (
    <div style={{ padding: "56px 64px 0" }}>
      {/* Greeting header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        style={{ marginBottom: 48 }}
      >
        <p
          style={{
            fontFamily: "monospace",
            fontSize: 10,
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.3)",
            marginBottom: 12,
          }}
        >
          {today}
        </p>
        <h1
          style={{
            fontSize: 40,
            fontWeight: 300,
            letterSpacing: "-0.03em",
            color: "rgba(255,255,255,0.92)",
            marginBottom: 8,
          }}
        >
          Bonsoir, Adrien.
        </h1>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.45)", fontWeight: 400 }}>
          L'agent a traité 47 événements pendant votre absence.
        </p>
      </motion.div>

      {/* Hero card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="vision-glass"
        style={{
          borderRadius: 20,
          padding: "32px 36px",
          marginBottom: 40,
        }}
      >
        <p
          style={{
            fontFamily: "monospace",
            fontSize: 10,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "#4A8B86",
            marginBottom: 10,
          }}
        >
          GMAIL // ACTION REQUISE
        </p>
        <h2
          style={{
            fontSize: 24,
            fontWeight: 500,
            letterSpacing: "-0.02em",
            color: "rgba(255,255,255,0.92)",
            marginBottom: 8,
          }}
        >
          5 drafts Gmail prêts pour relecture
        </h2>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginBottom: 28 }}>
          L'agent a rédigé des réponses pour vos fils prioritaires. Votre validation est requise
          avant envoi.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            className="vision-btn-primary"
            onClick={() => setStage("chat")}
            style={{
              padding: "10px 22px",
              borderRadius: 9999,
              fontSize: 13,
              cursor: "pointer",
              border: "none",
              fontWeight: 500,
            }}
          >
            Voir les drafts
          </button>
          <button
            className="vision-btn-glass"
            onClick={() => setStage("briefing")}
            style={{
              padding: "10px 22px",
              borderRadius: 9999,
              fontSize: 13,
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            Briefing complet
          </button>
          <button
            className="vision-btn-glass"
            onClick={() => setStage("mission")}
            style={{
              padding: "10px 22px",
              borderRadius: 9999,
              fontSize: 13,
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            Missions actives
          </button>
        </div>
      </motion.div>

      {/* Activity list */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <p
          style={{
            fontFamily: "monospace",
            fontSize: 10,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.25)",
            marginBottom: 12,
            paddingBottom: 10,
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          Activité récente
        </p>

        {ACTIVITY.map((row, i) => (
          <motion.button
            key={row.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25 + i * 0.06, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            onClick={() => setStage(row.stage)}
            style={{
              display: "grid",
              gridTemplateColumns: "80px 1fr 80px",
              gap: 16,
              alignItems: "center",
              width: "100%",
              padding: "16px 0",
              borderBottom: "1px solid rgba(255,255,255,0.04)",
              background: "transparent",
              border: "none",
              borderBottomWidth: 1,
              borderBottomStyle: "solid",
              borderBottomColor: "rgba(255,255,255,0.04)",
              cursor: "pointer",
              textAlign: "left",
              transition: "background 150ms ease",
            }}
            whileHover={{ backgroundColor: "rgba(255,255,255,0.02)" }}
          >
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 10,
                color: "rgba(255,255,255,0.3)",
                letterSpacing: "0.05em",
              }}
            >
              {row.id}
            </span>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", fontWeight: 400 }}>
              {row.label}
            </span>
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 10,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: STATUS_COLOR[row.status] ?? "rgba(255,255,255,0.35)",
                textAlign: "right",
              }}
            >
              {row.status}
            </span>
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
}
