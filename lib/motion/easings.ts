/**
 * Constantes d'easing pour Framer Motion.
 *
 * Ces valeurs correspondent aux tokens CSS --ease-* définis dans app/globals.css.
 * Framer Motion n'accepte pas de CSS var() dans son API `ease` (tableau de nombres)
 * donc on centralise ici les équivalents TS pour garantir la cohérence DS.
 *
 * Usage : import { EASE_VISION } from "@/lib/motion/easings";
 *         transition={{ ease: EASE_VISION }}
 */

/** Équivalent JS de --ease-vision: cubic-bezier(0.22, 1, 0.36, 1) — entrée visionOS */
export const EASE_VISION = [0.22, 1, 0.36, 1] as const;

/** Équivalent JS de --ease-spring: cubic-bezier(0.16, 1, 0.3, 1) — spring léger */
export const EASE_SPRING = [0.16, 1, 0.3, 1] as const;

/** Équivalent JS de --ease-standard: cubic-bezier(0.4, 0, 0.2, 1) — Material standard */
export const EASE_STANDARD = [0.4, 0, 0.2, 1] as const;
