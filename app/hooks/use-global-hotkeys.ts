"use client";

/**
 * useGlobalHotkeys — Hooks raccourcis globaux pour Hearst OS.
 *
 * - ⌘K        : toggle Commandeur (palette)
 * - ⌘1..⌘9    : switch direct vers un Stage (cockpit/chat/asset/browser/
 *               meeting/kg/voice/simulation/mission — grille systématique,
 *               voir STAGE_HOTKEYS)
 * - ⌘0        : ArtifactStage (B8 — code editor + E2B run)
 * - ⌘⇧V       : toggle direct mode voix ambient (raccourci alternatif
 *               à ⌘7, accessible même quand un autre Stage est actif)
 * - ⌘⇧F       : toggle Mode Focus (S4-B — Stage 100vw, Rails masqués)
 * - ⌘B        : toggle WorkingDocument (Thinking Canvas — Lot C)
 * - ⌘G        : toggle VideoQuickLaunch (S2-A — panel ⌘G + SSE progress)
 * - ⌘⌫        : back stage
 * - Échap     : sort du Mode Focus si actif
 *
 * Ignore les inputs / textarea / contenteditable pour ne pas voler les
 * touches au user en pleine saisie.
 */

import { useEffect } from "react";
import { useFocusMode } from "@/stores/focus-mode";
import { STAGE_HOTKEYS, useStageStore } from "@/stores/stage";
import { useVideoQuickLaunchStore } from "@/stores/video-quick-launch";
import { useVoiceStore } from "@/stores/voice";
import { useWorkingDocumentStore } from "@/stores/working-document";

export function useGlobalHotkeys() {
  const toggleCommandeur = useStageStore((s) => s.toggleCommandeur);
  const setMode = useStageStore((s) => s.setMode);
  const back = useStageStore((s) => s.back);

  useEffect(() => {
    const isInInput = (e: KeyboardEvent): boolean => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable === true;
    };

    const onKey = (e: KeyboardEvent) => {
      // ⌘K : autorisé même en input (palette globale)
      const meta = e.metaKey || e.ctrlKey;

      // ⌘⇧V → mode voix ambient (toggle). Doit être checké AVANT le early
      // return `if (!meta) return;` ne change rien (meta est requis), mais
      // checké AVANT les ⌘+lettre simples sinon collision.
      if (meta && e.shiftKey && (e.key === "v" || e.key === "V")) {
        e.preventDefault();
        const stage = useStageStore.getState();
        const voice = useVoiceStore.getState();
        if (stage.current.mode === "voice") {
          voice.setVoiceActive(false);
          stage.back();
        } else {
          voice.setVoiceActive(true);
          stage.setMode({ mode: "voice" });
        }
        return;
      }

      // ⌘⇧F → toggle Mode Focus (S4-B). Stage 100vw, Rails masqués,
      // PulseBar rétracté. Checké AVANT le early return meta pour
      // prendre la priorité sur ⌘F natif (rare, browser only).
      if (meta && e.shiftKey && (e.key === "f" || e.key === "F")) {
        e.preventDefault();
        useFocusMode.getState().toggle();
        return;
      }

      // Échap → sort du Mode Focus si actif. Pas de meta requis,
      // donc checké hors du `if (!meta) return;`. Ne préempte pas
      // les autres usages d'ESC (modales, etc.) car le toggle ne
      // s'applique que si le mode focus est effectivement enabled.
      if (e.key === "Escape" && useFocusMode.getState().enabled) {
        e.preventDefault();
        useFocusMode.getState().disable();
        return;
      }

      if (!meta) return;

      if (e.key === "k" || e.key === "K") {
        e.preventDefault();
        toggleCommandeur();
        return;
      }

      // ⌘B → toggle WorkingDocument (Thinking Canvas — Lot C).
      // No-op silencieux si aucun document n'a encore été ouvert
      // (le store toggle gère ce cas).
      if (e.key === "b" || e.key === "B") {
        e.preventDefault();
        useWorkingDocumentStore.getState().toggle();
        return;
      }

      // ⌘G → toggle VideoQuickLaunch (S2-A). Autorisé même en input pour
      // ouvrir le panel depuis n'importe quel contexte (le panel ouvre son
      // propre textarea — l'utilisateur peut continuer à taper dedans).
      if (e.key === "g" || e.key === "G") {
        e.preventDefault();
        useVideoQuickLaunchStore.getState().toggle();
        return;
      }

      // Le reste : skip si user en train de taper
      if (isInInput(e)) return;

      // ⌘1..⌘7 : switch stages (voice = ⌘7, plus de ⌘⇧V redondant)
      const hk = STAGE_HOTKEYS.find((h) => h.key === e.key);
      if (hk) {
        e.preventDefault();
        // Dispatch avec payload minimal — les modes browser/meeting/kg/asset
        // qui requièrent un payload spécifique gèrent l'empty state
        // gracieusement (sessionId vide → empty state Stage).
        switch (hk.mode) {
          case "cockpit":
            setMode({ mode: "cockpit" });
            break;
          case "chat":
            setMode({ mode: "chat" });
            break;
          case "asset": {
            // Ré-ouvre le dernier asset cliqué (depuis stage store).
            // No-op silencieux si aucun asset n'a encore été ouvert —
            // évite de push un AssetStage avec assetId vide qui afficherait
            // un placeholder dénué de sens.
            const lastAssetId = useStageStore.getState().lastAssetId;
            if (lastAssetId) {
              setMode({ mode: "asset", assetId: lastAssetId });
            }
            break;
          }
          case "mission": {
            // Même logique que "asset" : ré-ouvre la dernière mission
            // ouverte. No-op si aucune mission n'a encore été ouverte —
            // l'user passe alors par /missions ou le Commandeur.
            const lastMissionId = useStageStore.getState().lastMissionId;
            if (lastMissionId) {
              setMode({ mode: "mission", missionId: lastMissionId });
            }
            break;
          }
          case "browser":
            setMode({ mode: "browser", sessionId: "" });
            break;
          case "meeting":
            setMode({ mode: "meeting", meetingId: "" });
            break;
          case "kg":
            setMode({ mode: "kg" });
            break;
          case "voice":
            useVoiceStore.getState().setVoiceActive(true);
            setMode({ mode: "voice" });
            break;
          case "simulation":
            setMode({ mode: "simulation" });
            break;
          case "artifact":
            setMode({ mode: "artifact" });
            break;
        }
        return;
      }

      // ⌘⌫ : back
      if (e.key === "Backspace") {
        e.preventDefault();
        back();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleCommandeur, setMode, back]);
}
