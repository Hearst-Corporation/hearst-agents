/**
 * Constantes et types partagés du module AssetVariantTabs.
 *
 * Préserve l'API publique (constantes load-bearing) :
 * - POLL_INTERVAL_MS : cadence du polling /api/v2/assets/[id]/variants
 * - GENERATION_TIMEOUT_MS : watchdog WF5 (timeout local UI uniquement)
 */

import type { AssetVariantKind } from "@/lib/assets/variants";

/** Cadence du polling tant qu'un variant est `pending` ou `generating`. */
export const POLL_INTERVAL_MS = 4_000;

/** [WF5] Au-delà de 10 minutes en generating → timeout local. */
export const GENERATION_TIMEOUT_MS = 10 * 60 * 1000;

export type VideoRatio = "1280:720" | "720:1280";

/** Onglets exposés dans l'UI — exclut text/slides/site (non implémentés). */
export const TABS: ReadonlyArray<{ kind: AssetVariantKind; label: string }> = [
  { kind: "audio", label: "Audio" },
  { kind: "video", label: "Vidéo" },
  { kind: "image", label: "Image" },
  { kind: "code", label: "Code" },
];

export const VARIANT_LABELS: Record<AssetVariantKind, string> = {
  audio: "Audio",
  video: "Vidéo",
  image: "Image",
  code: "Code",
  text: "Texte",
  slides: "Slides",
  site: "Site",
};

export interface TabCopy {
  empty: string;
  cta: string;
  ctaLoading: string;
}

/** Microcopy par kind pour l'empty state et le CTA de génération. */
export const TAB_META: Record<string, TabCopy> = {
  audio: {
    empty:
      "Pas encore de variant audio. Génère un fichier audio narré à partir du texte de cet asset (ElevenLabs TTS).",
    cta: "Générer l'audio",
    ctaLoading: "Création…",
  },
  video: {
    empty:
      "Pas encore de variant vidéo. Génère une vidéo animée à partir de cet asset (HeyGen / Runway).",
    cta: "Générer la vidéo",
    ctaLoading: "Création…",
  },
  image: {
    empty:
      "Pas encore d'image générée. Génère une illustration à partir du titre ou du contenu (fal.ai).",
    cta: "Générer l'image",
    ctaLoading: "Création…",
  },
  code: {
    empty:
      "Pas encore de résultat d'exécution. Lance le code associé à cet asset dans un sandbox sécurisé (E2B).",
    cta: "Exécuter le code",
    ctaLoading: "Exécution…",
  },
};

export interface ForkPanelState {
  parentId: string;
  parentKind: AssetVariantKind;
  prompt: string;
  duration: number;
  ratio: VideoRatio;
}
