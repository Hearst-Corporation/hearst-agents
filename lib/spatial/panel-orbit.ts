/**
 * Layout solver orbital pour le cockpit spatial.
 *
 * Calcule la position 2D + profondeur Z de chaque panel ouvert, en fonction
 * de son rang d'orbite, du nombre total de panels actifs et du centre du
 * robot Spline.
 *
 * Convention : coordonnées en pourcent du viewport pour x/y (sera converti
 * en CSS `left`/`top`), depthZ en px CSS.
 *
 * Les orbites sont des **arcs à gauche** du robot (qui est lui-même décalé
 * à droite via translate-x-[20%]). Le centre orbital est donc côté gauche
 * du viewport.
 */

import type { SpatialPanelType } from "./panel-types";

export interface OrbitPosition {
  /** x en pourcent du viewport (0-100), centre du panel. */
  xPct: number;
  /** y en pourcent du viewport. */
  yPct: number;
  /** Profondeur Z en px CSS. Négatif = arrière, positif = avant. */
  depthZ: number;
  /** Rotation Y du panel pour qu'il "regarde" vers le centre orbital. */
  rotateY: number;
}

/**
 * Centre de repos : une seule carte contextuelle, à gauche du robot, sans
 * empiéter sur la silhouette ni sortir du viewport.
 */
const REST_PANEL_X_PCT = 32;
const REST_PANEL_Y_PCT = 43;

/**
 * Pour un index d'orbite donné, calcule sa position dans le pattern orbital.
 *
 * Pattern :
 * - orbit 0 : très proche du centre orbital, légèrement à gauche (vedette)
 * - orbit 1 : orbit nord (haut)
 * - orbit 2 : orbit sud (bas)
 * - orbit 3 : orbit nord-est (proche du robot)
 * - orbit 4 : orbit sud-est
 * - orbit 5 : orbit nord-ouest (très loin)
 *
 * Z décroît avec l'orbite : orbit 0 = avant-plan (0), orbit 5 = arrière (-160).
 */
export function getOrbitPosition(orbit: number, totalPanels: number): OrbitPosition {
  // Si un seul panel est ouvert, on garde une composition luxe et respirante :
  // robot à droite, contexte lisible à gauche.
  if (totalPanels === 1) {
    return {
      xPct: REST_PANEL_X_PCT,
      yPct: REST_PANEL_Y_PCT,
      depthZ: 0,
      rotateY: -2,
    };
  }

  // Composition en colonne lisible à gauche. Les positions sont assez espacées
  // pour absorber un panel manuel + un panel agent sans superposition.
  const positions: OrbitPosition[] = [
    { xPct: 33, yPct: 42, depthZ: 0, rotateY: -2 },
    { xPct: 25, yPct: 22, depthZ: -48, rotateY: -4 },
    { xPct: 25, yPct: 68, depthZ: -96, rotateY: -4 },
    { xPct: 43, yPct: 23, depthZ: -124, rotateY: 1 },
    { xPct: 43, yPct: 67, depthZ: -148, rotateY: 1 },
    { xPct: 34, yPct: 80, depthZ: -168, rotateY: -2 },
  ];

  const idx = Math.max(0, Math.min(orbit, positions.length - 1));
  return positions[idx];
}

/**
 * Largeur cible d'un panel selon son orbite (plus on est en orbite haute,
 * plus on est grand parce qu'on est en vedette).
 *
 * Retourne une largeur en px (à passer en max-width sur le wrapper).
 */
export function getOrbitPanelWidth(orbit: number, type: SpatialPanelType): number {
  // Cas spéciaux par type (KPI bandeau, Assets bandeau)
  if (type === "brief") return orbit === 0 ? 420 : 360;
  if (type === "chat-response") return orbit === 0 ? 460 : 400;
  if (type === "mission") return orbit === 0 ? 400 : 340;
  if (type === "kpi" || type === "kpi-pulse") return 340;
  if (type === "assets") return 340;
  if (type === "notification") return 280;
  if (type === "approval" || type === "clarification") return 480;

  // Sinon par orbite
  switch (orbit) {
    case 0:
      return 420;
    case 1:
    case 2:
      return 340;
    case 3:
    case 4:
      return 300;
    default:
      return 260;
  }
}

/**
 * Hauteur cible d'un panel selon son type.
 *
 * Les panels HTML glassmorphism ont besoin d'une hauteur min sinon le
 * contenu de la card (justify-between, mt-auto) ne s'expand pas.
 */
export function getOrbitPanelHeight(type: SpatialPanelType): number {
  if (type === "kpi" || type === "kpi-pulse") return 110;
  if (type === "assets") return 130;
  if (type === "mission") return 170;
  if (type === "brief") return 280;
  if (type === "approval" || type === "clarification") return 280;
  if (type === "chat-response") return 240;
  if (type === "asset-preview") return 220;
  return 200;
}

/**
 * Position spéciale "interruptif centré" : pour ApprovalPanel,
 * ClarificationPanel, ConnectionAlert. Ils sortent du système orbital et
 * apparaissent centrés au-dessus du robot avec un dim global.
 */
export function getInterruptivePosition(): OrbitPosition {
  return {
    xPct: 38,
    yPct: 42,
    depthZ: 120, // bien devant tout
    rotateY: 0,
  };
}
