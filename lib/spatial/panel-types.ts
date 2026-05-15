/**
 * Types canoniques de panels pour le cockpit spatial dynamique.
 *
 * Chaque type a une priorité fixe qui dicte son ordering Z et son comportement
 * d'éjection quand la scène est saturée.
 *
 * Convention : minuscules, kebab-case.
 */

export type SpatialPanelType =
  // Sticky (presque toujours visibles)
  | "brief"
  | "kpi"
  // Active (apparaissent pendant les runs)
  | "mission"
  | "plan-step"
  | "chat-response"
  // Interruptif (centrés, bloquent le reste)
  | "approval"
  | "clarification"
  // Éphémères (fade-out auto)
  | "asset-preview"
  | "kpi-pulse"
  | "memory-recall"
  // Info
  | "assets"
  | "notification"
  | "connection-alert"
  | "meeting-intel";

/**
 * Priorité d'un panel : plus haut = plus prioritaire en cas de saturation.
 * Les panels prioritaires éjectent les moins prioritaires (LRU dans la priorité).
 */
export type SpatialPanelPriority = 1 | 3 | 5 | 8 | 10;

/**
 * Catégorie comportementale d'un panel.
 *
 * - sticky : ouvert tant que sa condition est vraie, ne se ferme pas tout seul
 * - active : ouvert pendant un run, se ferme quand le run finit
 * - interruptive : bloque le reste de la scène (overlay), tout passe defocused
 * - ephemeral : auto-fade après TTL ou interaction
 * - info : ouvert temporairement, fermable
 */
export type SpatialPanelCategory = "sticky" | "active" | "interruptive" | "ephemeral" | "info";

/**
 * Configuration statique par type. Source de vérité pour priorité, catégorie,
 * comportement TTL, slot d'orbite préféré.
 */
export interface SpatialPanelConfig {
  type: SpatialPanelType;
  priority: SpatialPanelPriority;
  category: SpatialPanelCategory;
  /** TTL en ms après stabilisation (ephemeral seulement). null = pas d'auto-close. */
  ttlMs: number | null;
  /** Index d'orbite préféré (0 = nearest, 5 = farthest). Le layout solver
   *  peut le déplacer si conflit. */
  preferredOrbit: number;
}

export const SPATIAL_PANEL_CONFIG: Record<SpatialPanelType, SpatialPanelConfig> = {
  // Critiques
  approval: {
    type: "approval",
    priority: 10,
    category: "interruptive",
    ttlMs: null,
    preferredOrbit: 0,
  },
  clarification: {
    type: "clarification",
    priority: 10,
    category: "interruptive",
    ttlMs: null,
    preferredOrbit: 0,
  },
  "connection-alert": {
    type: "connection-alert",
    priority: 10,
    category: "interruptive",
    ttlMs: null,
    preferredOrbit: 0,
  },

  // Actives
  mission: { type: "mission", priority: 8, category: "active", ttlMs: null, preferredOrbit: 1 },
  "plan-step": {
    type: "plan-step",
    priority: 8,
    category: "active",
    ttlMs: null,
    preferredOrbit: 2,
  },
  "asset-preview": {
    type: "asset-preview",
    priority: 8,
    category: "ephemeral",
    ttlMs: 30_000,
    preferredOrbit: 1,
  },
  "chat-response": {
    type: "chat-response",
    priority: 8,
    category: "ephemeral",
    ttlMs: 15_000,
    preferredOrbit: 0,
  },

  // Sticky
  brief: { type: "brief", priority: 5, category: "sticky", ttlMs: null, preferredOrbit: 0 },
  kpi: { type: "kpi", priority: 5, category: "sticky", ttlMs: null, preferredOrbit: 2 },
  "meeting-intel": {
    type: "meeting-intel",
    priority: 5,
    category: "sticky",
    ttlMs: null,
    preferredOrbit: 3,
  },

  // Info
  assets: { type: "assets", priority: 3, category: "info", ttlMs: null, preferredOrbit: 3 },
  "kpi-pulse": {
    type: "kpi-pulse",
    priority: 3,
    category: "ephemeral",
    ttlMs: 6_000,
    preferredOrbit: 4,
  },
  "memory-recall": {
    type: "memory-recall",
    priority: 3,
    category: "ephemeral",
    ttlMs: 10_000,
    preferredOrbit: 4,
  },
  notification: {
    type: "notification",
    priority: 1,
    category: "ephemeral",
    ttlMs: 8_000,
    preferredOrbit: 5,
  },
};

/**
 * Limite hard du nombre de panels actifs simultanément. Au-delà, éjection
 * du moins prioritaire (puis du plus ancien à priorité égale).
 */
export const MAX_ACTIVE_PANELS = 6;
