/**
 * STAGE_REGISTRY — source de vérité unique du shell visionOS.
 *
 * Une entrée par mode polymorphe de `useStageStore` (12 au total). Chaque
 * entrée fournit :
 *   - label / navLabel : libellés visibles (centre + LeftRail)
 *   - hotkey : raccourci affiché (purement informatif — la logique
 *     d'écoute est dans `app/hooks/use-global-hotkeys.ts`)
 *   - footer : config FloatingFooter LEGACY — voir note ci-dessous
 *   - railTitle : titre de la RightRail par défaut
 *
 * ⚠️ FOOTER LEGACY — depuis le pivot Factory Cockpit (2026-05), la
 * navigation primaire vit dans `app/(user)/components/_shell/StageFooter.tsx`
 * (dock fixe Dashboard / Chat / Mission + Commandeur). Les champs
 * `footer.actions` et `footer.modes` ci-dessous ne pilotent PLUS le footer
 * primaire — ils restent comme fallback statique tant qu'aucun
 * `onActionClick` / `onModeClick` n'est passé (cf. `FooterConfig` dans
 * types.ts : sans handler les chips ne sont pas rendus interactifs). À
 * traiter comme contenu décoratif / placeholder par mode tant que les
 * Stages n'injectent pas leurs propres handlers data-bound.
 *
 * Ordre LEFT_RAIL_ORDER : du haut vers le bas dans la rail 88px. Les
 * hotkeys ⌘1..9 + ⌘0 sont mappés via STAGE_HOTKEYS dans stores/stage.ts
 * — on les duplique ici uniquement pour l'affichage.
 *
 * ⚠️ LOCKED après P3 — le typing et l'ensemble des 12 entrées sont
 * stables. Les fixers P5/P6 lisent ce registry mais ne le modifient
 * jamais (anti-conflit registry lors des merges parallèles).
 *
 * Sources de référence :
 *   - app/(user)/components/_shell/StageFooter.tsx (footer primaire actuel)
 *   - lab/cli-os/src/scenes/CockpitScene.tsx (labels d'origine)
 *   - stores/stage.ts (12 modes polymorphes verrouillés)
 */

import type { StageDef, StageKey } from "./types";

export const STAGE_REGISTRY: Record<StageKey, StageDef> = {
  cockpit: {
    key: "cockpit",
    label: "Accueil",
    navLabel: "Accueil",
    hotkey: "⌘1",
    railTitle: "Aperçu du jour",
    footer: {
      status: "Brief du jour prêt",
      actions: ["Brief", "Activité", "Calme"],
      modes: ["Autonome", "Confirme"],
    },
  },
  chat: {
    key: "chat",
    label: "Chat",
    navLabel: "Chat",
    hotkey: "⌘2",
    railTitle: "Outils",
    footer: {
      status: "Prêt",
      actions: ["Continuer", "Brouillon", "Annuler"],
      modes: ["Texte", "Voice"],
    },
  },
  asset: {
    key: "asset",
    label: "Assets",
    navLabel: "Assets",
    hotkey: "⌘3",
    railTitle: "Paramètres",
    footer: {
      status: "Génération · 0 variants",
      actions: ["Choisir", "Régénérer", "Comparer"],
      modes: ["Veo3", "Runway"],
    },
  },
  asset_compare: {
    key: "asset_compare",
    label: "Compare",
    navLabel: "Compare",
    railTitle: "Métriques",
    footer: {
      status: "Comparaison",
      actions: ["Gauche", "Droite", "Reset"],
      modes: ["Split", "Overlay"],
    },
  },
  browser: {
    key: "browser",
    label: "Browser",
    navLabel: "Browser",
    hotkey: "⌘4",
    railTitle: "Session",
    footer: {
      status: "Browser piloté",
      actions: ["Live", "Steps", "Capture"],
      modes: ["Auto", "Pas-à-pas"],
    },
  },
  meeting: {
    key: "meeting",
    label: "Meeting",
    navLabel: "Meeting",
    hotkey: "⌘5",
    railTitle: "Action items",
    footer: {
      status: "Transcript live",
      actions: ["Notes", "Actions", "Résumé"],
      modes: ["Live", "Replay"],
    },
  },
  kg: {
    key: "kg",
    label: "KG",
    navLabel: "KG",
    hotkey: "⌘6",
    railTitle: "Propriétés",
    footer: {
      status: "0 entités liées",
      actions: ["Explorer", "Recentrer", "Filtrer"],
      modes: ["Graph", "Liste"],
    },
  },
  voice: {
    key: "voice",
    label: "Voice",
    navLabel: "Voice",
    hotkey: "⌘7",
    railTitle: "Session",
    footer: {
      status: "En écoute",
      actions: ["Parler", "Pause", "Mémo"],
      modes: ["Voice", "Texte"],
    },
  },
  simulation: {
    key: "simulation",
    label: "Sim",
    navLabel: "Sim",
    hotkey: "⌘8",
    railTitle: "Variables",
    footer: {
      status: "Simulation active",
      actions: ["Play", "Pause", "Reset"],
      modes: ["Live", "Step"],
    },
  },
  mission: {
    key: "mission",
    label: "Mission",
    navLabel: "Mission",
    hotkey: "⌘9",
    railTitle: "Étapes",
    footer: {
      status: "Mission en cours",
      actions: ["Approuver", "Relire", "Annuler"],
      modes: ["Auto", "Pas-à-pas"],
    },
  },
  artifact: {
    key: "artifact",
    label: "Artifact",
    navLabel: "Artifact",
    hotkey: "⌘0",
    railTitle: "Sandbox",
    footer: {
      status: "Build E2B",
      actions: ["Preview", "Code", "Versions"],
      modes: ["Sandbox", "Local"],
    },
  },
  signal: {
    key: "signal",
    label: "Signaux",
    navLabel: "Signaux",
    railTitle: "Connecteurs",
    footer: {
      status: "0 critique · 0 actifs",
      actions: ["Reconnecter", "Ignorer", "Détails"],
      modes: ["Live", "Historique"],
    },
  },
  connections: {
    key: "connections",
    label: "Connexions",
    navLabel: "Connexions",
    railTitle: "Intégrations",
    footer: {
      status: "Configuration",
      actions: ["Ajouter", "Configurer", "Révoquer"],
      modes: ["Liste", "Détail"],
    },
  },
};

/**
 * Ordre LeftRail (88px) — du haut vers le bas. 13 slots, un par mode.
 *
 * Cmd+1..9 + Cmd+0 mappés via STAGE_HOTKEYS (stores/stage.ts). Les modes
 * `asset_compare` et `signal` n'ont pas de hotkey direct (accessibles
 * uniquement via LeftRail ou Commandeur ⌘K) — placés en bas du rail.
 *
 * Mémo : l'ordre suit la grille systématique du store (cockpit > chat >
 * asset > browser > meeting > kg > voice > simulation > mission >
 * artifact) puis les 3 modes sans hotkey en queue (signal > asset_compare > connections).
 */
export const LEFT_RAIL_ORDER: readonly StageKey[] = [
  "cockpit",
  "chat",
  "asset",
  "browser",
  "meeting",
  "kg",
  "voice",
  "simulation",
  "mission",
  "artifact",
  "signal",
  "asset_compare",
  "connections",
] as const;

/**
 * Helper accessor — retourne le `label` court d'un mode (pour l'aria-label
 * + tooltip de la LeftRail). Évite d'importer le registry partout.
 */
export function getStageLabel(key: StageKey): string {
  return STAGE_REGISTRY[key].label;
}
