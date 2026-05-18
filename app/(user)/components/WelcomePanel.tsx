"use client";

import { useNavigationStore } from "@/stores/navigation";
import { useStageStore } from "@/stores/stage";
import { CockpitHero } from "./CockpitHero";

/**
 * WelcomePanel — Empty state du ChatStage (mode="chat" sans messages).
 *
 * Si un thread est déjà actif, on skip le greeting CockpitHero : il fait
 * doublon avec <ConversationHeader> (titre + date) qui est rendu par
 * ChatStage juste au-dessus. Sinon (cas rare : ChatStage sans thread),
 * on garde le greeting éditorial pour ne pas atterrir sur un écran vide.
 */
export function WelcomePanel() {
  const addThread = useNavigationStore((s) => s.addThread);
  const setStageMode = useStageStore((s) => s.setMode);
  const setCommandeurOpen = useStageStore((s) => s.setCommandeurOpen);
  const activeThreadId = useNavigationStore((s) => s.activeThreadId);

  const newBrief = () => {
    const threadId = addThread("New", "home");
    setStageMode({ mode: "chat", threadId });
  };

  const focusInput = () => {
    const ta = document.querySelector<HTMLTextAreaElement>("textarea");
    ta?.focus();
  };

  // Les artefacts vivent dans le ChatStage (modes asset/artifact), pas
  // sur une route dédiée. On ouvre le Commandeur (Cmd+K) pour les chercher
  // sans envoyer l'utilisateur sur une 404.
  const openCommandeurArtefacts = () => {
    setCommandeurOpen(true, { prefilledQuery: "artefact " });
  };

  // Parcours guidé — l'utilisateur arrive sur un cockpit vide sans savoir
  // par où commencer. On expose les 3 étapes du happy path canonique
  // (connecter → demander → planifier) avec des navigations existantes.
  const openConnections = () => {
    setStageMode({ mode: "connections" });
  };

  const openMissions = () => {
    setStageMode({ mode: "mission" });
  };

  const GUIDED_PATH = [
    { step: "1", label: "Connecter une app (Gmail, Slack…)", action: openConnections },
    { step: "2", label: "Demander un brief ou une recherche", action: newBrief },
    { step: "3", label: "Programmer une mission récurrente", action: openMissions },
  ];

  const QUICK_ACTIONS = [
    { label: "Brief du jour", action: newBrief },
    { label: "Lancer une recherche", action: focusInput },
    { label: "Trouver un artefact", action: openCommandeurArtefacts },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {!activeThreadId && <CockpitHero />}

      <div
        style={{
          padding: activeThreadId ? "var(--space-12)" : "0 var(--space-12) var(--space-12)",
        }}
      >
        {!activeThreadId && (
          <>
            <p
              className="t-13 font-medium"
              style={{ color: "var(--text-l1)", marginBottom: "var(--space-4)" }}
            >
              Premier parcours
            </p>
            <div style={{ marginBottom: "var(--space-8)" }}>
              {GUIDED_PATH.map((a) => (
                <button key={a.step} type="button" onClick={a.action} className="cockpit-action">
                  <span className="ca-label">
                    <span style={{ color: "var(--text-faint)" }}>{a.step}.</span> {a.label}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        <p
          className="t-13 font-medium"
          style={{
            color: "var(--text-l1)",
            marginBottom: "var(--space-8)",
          }}
        >
          Raccourcis
        </p>
        {QUICK_ACTIONS.map((a) => (
          <button key={a.label} type="button" onClick={a.action} className="cockpit-action">
            <span className="ca-label">{a.label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0" />
    </div>
  );
}
