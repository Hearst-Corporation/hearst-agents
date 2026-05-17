"use client";

/**
 * useCommandeurActions — table des actions hardcodées de la palette Cmd+K.
 *
 * Séparé du composant Commandeur pour réduire la taille de fichier. Les
 * perform() sont des closures qui reçoivent les callbacks en paramètre.
 * Aucune logique métier ici — uniquement des dispatch router/stage/voice.
 *
 * Invariants F-16 : non touchés (debounce, LRU, abort dans use-commandeur-data).
 */

import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { useMemo } from "react";
import type { StagePayload } from "@/stores/stage";
import { useVoiceStore } from "@/stores/voice";
import type { CommandeurResultKind } from "./CommandeurResultRow";

export interface CommandRow {
  id: string;
  kind: CommandeurResultKind;
  label: string;
  hint?: string;
  hotkey?: string;
  disabled?: boolean;
  /**
   * Stream B / T-B5 : libellé optionnel affiché en toast après `perform()`.
   * Si non défini → fallback générique "Action effectuée". Utile pour les
   * rows qui résolvent silencieusement (ex: dispatch stage), pas pour les
   * rows qui ouvrent une nouvelle vue où le feedback visuel suffit.
   */
  toastLabel?: string;
  perform: () => void;
}

interface UseCommandeurActionsParams {
  router: AppRouterInstance;
  setOpen: (v: boolean) => void;
  setStageMode: (payload: StagePayload) => void;
  lastAssetId: string | null;
  onCompareOpen: () => void;
}

export function useCommandeurActions({
  router,
  setOpen,
  setStageMode,
  lastAssetId,
  onCompareOpen,
}: UseCommandeurActionsParams): CommandRow[] {
  return useMemo<CommandRow[]>(
    () => [
      {
        id: "nav-reports",
        kind: "action",
        label: "Voir les rapports",
        hint: "Bibliothèque rapports",
        perform: () => {
          router.push("/reports");
          setOpen(false);
        },
      },
      {
        id: "nav-missions",
        kind: "action",
        label: "Mes missions",
        hint: "Modèles récurrents — créer, modifier, lancer",
        perform: () => {
          router.push("/missions");
          setOpen(false);
        },
      },
      {
        id: "nav-runs",
        kind: "action",
        label: "Mes exécutions",
        hint: "Historique des runs lancés",
        perform: () => {
          router.push("/runs");
          setOpen(false);
        },
      },
      {
        id: "nav-notifications",
        kind: "action",
        label: "Voir les notifications",
        hint: "Centre signaux et alertes",
        perform: () => {
          router.push("/notifications");
          setOpen(false);
        },
      },
      {
        id: "nav-apps",
        kind: "action",
        label: "Voir les apps connectées",
        hint: "Connecteurs OAuth",
        perform: () => {
          router.push("/apps");
          setOpen(false);
        },
      },
      {
        id: "nav-marketplace",
        kind: "action",
        label: "Marketplace",
        hint: "Templates communautaires partagés",
        perform: () => {
          router.push("/marketplace");
          setOpen(false);
        },
      },
      {
        id: "nav-settings",
        kind: "action",
        label: "Réglages",
        hint: "Préférences · alerting · profil",
        perform: () => {
          router.push("/settings");
          setOpen(false);
        },
      },
      {
        id: "nav-settings-alerting",
        kind: "action",
        label: "Paramètres alerting",
        hint: "Seuils · canaux · règles",
        perform: () => {
          router.push("/settings/alerting");
          setOpen(false);
        },
      },
      {
        id: "open-archive",
        kind: "action",
        label: "Voir l'archive",
        hint: "Threads + assets > 7 jours",
        perform: () => {
          router.push("/archive");
          setOpen(false);
        },
      },
      {
        id: "open-hospitality",
        kind: "action",
        label: "Hospitality Mode",
        hint: "Cockpit vertical hôtellerie",
        perform: () => {
          router.push("/hospitality");
          setOpen(false);
        },
      },
      {
        id: "open-admin",
        kind: "action",
        label: "Console admin",
        hint: "Pipeline · agents · profiles",
        perform: () => {
          router.push("/admin");
          setOpen(false);
        },
      },
      {
        id: "action-new-mission",
        kind: "action",
        label: "Nouvelle mission",
        hint: "Crée un nouveau modèle (drawer rapide)",
        perform: () => {
          router.push("/missions?new=1");
          setOpen(false);
        },
      },
      {
        id: "action-launch-report",
        kind: "action",
        label: "Lancer un rapport",
        hint: "Studio création rapport",
        perform: () => {
          router.push("/reports/studio");
          setOpen(false);
        },
      },
      {
        id: "go-cockpit",
        kind: "action",
        label: "Ouvrir le Cockpit",
        hint: "Briefing du jour",
        hotkey: "⌘1",
        perform: () => {
          setStageMode({ mode: "cockpit" } as StagePayload);
          setOpen(false);
        },
      },
      {
        id: "go-chat",
        kind: "action",
        label: "Aller au Chat",
        hint: "Conversation active",
        hotkey: "⌘2",
        perform: () => {
          setStageMode({ mode: "chat" } as StagePayload);
          setOpen(false);
        },
      },
      {
        id: "go-asset",
        kind: "action",
        label: "Ouvrir le dernier asset",
        hint: lastAssetId ? "Ré-ouvre l'asset le plus récent" : "Aucun asset ouvert récemment",
        hotkey: "⌘3",
        disabled: !lastAssetId,
        perform: () => {
          if (!lastAssetId) return;
          setStageMode({ mode: "asset", assetId: lastAssetId } as StagePayload);
          setOpen(false);
        },
      },
      {
        id: "go-browser",
        kind: "action",
        label: "Browser Stage",
        hint: "Co-pilote navigation web",
        hotkey: "⌘4",
        perform: () => {
          setStageMode({ mode: "browser", sessionId: "" } as StagePayload);
          setOpen(false);
        },
      },
      {
        id: "go-meeting",
        kind: "action",
        label: "Meeting Stage",
        hint: "Bot meeting + action items",
        hotkey: "⌘5",
        perform: () => {
          setStageMode({ mode: "meeting", meetingId: "" } as StagePayload);
          setOpen(false);
        },
      },
      {
        id: "go-kg",
        kind: "action",
        label: "Knowledge Graph",
        hint: "Mémoire personnelle",
        hotkey: "⌘6",
        perform: () => {
          setStageMode({ mode: "kg" } as StagePayload);
          setOpen(false);
        },
      },
      {
        id: "go-voice",
        kind: "action",
        label: "Mode voix ambient",
        hint: "Conversation full-duplex",
        hotkey: "⌘7",
        perform: () => {
          useVoiceStore.getState().setVoiceActive(true);
          setStageMode({ mode: "voice" } as StagePayload);
          setOpen(false);
        },
      },
      {
        id: "go-simulation",
        kind: "action",
        label: "Chambre de Simulation",
        hint: "DeepSeek scenarios chiffrés",
        hotkey: "⌘8",
        perform: () => {
          setStageMode({ mode: "simulation" } as StagePayload);
          setOpen(false);
        },
      },
      {
        id: "go-artifact",
        kind: "action",
        label: "Artifact (code + E2B)",
        hint: "Éditeur Python/Node, run sandbox",
        hotkey: "⌘0",
        perform: () => {
          setStageMode({ mode: "artifact" } as StagePayload);
          setOpen(false);
        },
      },
      {
        id: "action-compare-assets",
        kind: "action",
        label: "Comparer 2 assets",
        hint: "Split view + diff sémantique",
        perform: () => {
          onCompareOpen();
          setOpen(false);
        },
      },
    ],
    [setStageMode, setOpen, router, lastAssetId, onCompareOpen],
  );
}
