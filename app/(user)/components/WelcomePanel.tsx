"use client";

import { useNavigationStore } from "@/stores/navigation";
import { useStageStore } from "@/stores/stage";
import { CockpitHero } from "./stages/CockpitHero";

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
