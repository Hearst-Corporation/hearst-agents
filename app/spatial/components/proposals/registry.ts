/**
 * Registry des assets explorables dans /spatial/playground.
 *
 * Organisé par FAMILLE (noyau, nodes, agents, asset card, …). Chaque famille
 * a son propre type de props (ex : Core a stage + hoveredNode + onClick ;
 * Node aura state + onClick ; etc.). Le playground sait afficher chaque
 * famille avec son chrome adapté.
 *
 * Pour ajouter une nouvelle variante : créer le composant dans le bon
 * sous-dossier puis l'ajouter à la famille correspondante ci-dessous.
 *
 * Pour ajouter une famille : créer un nouveau type Props, un nouveau bloc
 * AssetFamily, brancher le rendu dans /spatial/playground/page.tsx.
 */

import type { ComponentType } from "react";
import { LogoCore } from "../LogoCore";
import { ParticleSwarmCore } from "./ParticleSwarmCore";
import { MonolithCore } from "./MonolithCore";
import { AstrolabeCore } from "./AstrolabeCore";
import { MorphingBlobCore } from "./MorphingBlobCore";
import { WireframeNexusCore } from "./WireframeNexusCore";
import { GlassKnotVortexCore } from "./GlassKnotVortexCore";

export type CoreStage = "idle" | "focus" | "mission" | "asset";

export interface CoreProps {
  stage: CoreStage;
  hoveredNode: string | null;
  onClick: () => void;
}

export interface CoreVariant {
  id: string;
  label: string;
  source: "original" | "gemini";
  brief: string;
  Component: ComponentType<CoreProps>;
}

/** Familles d'assets exposées dans le playground. */
export type FamilyId = "core" | "nodes" | "agents" | "asset-card" | "background";

export interface AssetFamily {
  id: FamilyId;
  label: string;
  /** 1 ligne pour expliquer ce que la famille couvre. */
  description: string;
  /** Disponibilité — false = on affiche un placeholder "à venir". */
  available: boolean;
  /** Nombre de variantes (utilisé par le menu, indépendant des arrays
   *  pour pouvoir afficher 0 sur une famille pas encore peuplée). */
  count: number;
}

export const FAMILIES: ReadonlyArray<AssetFamily> = [
  {
    id: "core",
    label: "Noyau central",
    description: "La sphère / objet central de /spatial.",
    available: true,
    count: 7,
  },
  {
    id: "nodes",
    label: "Nodes orbitaux",
    description: "Points d'entrée vers les modules (Missions, Connecteurs…).",
    available: false,
    count: 0,
  },
  {
    id: "agents",
    label: "Agents en mission",
    description: "Les particules qui orbitent pendant un run actif.",
    available: false,
    count: 0,
  },
  {
    id: "asset-card",
    label: "Asset card",
    description: "Card glassmorphique du résultat de mission.",
    available: false,
    count: 0,
  },
  {
    id: "background",
    label: "Background ambient",
    description: "Particules / nébuleuse derrière le noyau.",
    available: false,
    count: 0,
  },
];

export const CORE_VARIANTS: ReadonlyArray<CoreVariant> = [
  {
    id: "original",
    label: "Original — Glass Core",
    source: "original",
    brief:
      "Sphère verre transmissive avec inner core + ring. Référence baseline.",
    Component: LogoCore,
  },
  {
    id: "glass-knot-vortex",
    label: "Glass Knot Vortex",
    source: "gemini",
    brief:
      "Asset GLTF haute qualité (Torus Knot). Verre transmissif, rotation lente, micro-respiration. Référence visuelle de qualité cible.",
    Component: GlassKnotVortexCore,
  },
  {
    id: "particle-swarm",
    label: "Particle Swarm",
    source: "gemini",
    brief:
      "Noyau noir entouré d'un essaim de particules (Sparkles). Densité variable selon le stage.",
    Component: ParticleSwarmCore,
  },
  {
    id: "monolith",
    label: "Monolith",
    source: "gemini",
    brief:
      "Octaèdre métal noir avec arêtes mises en valeur. Flottaison verticale lente, rotation Y.",
    Component: MonolithCore,
  },
  {
    id: "astrolabe",
    label: "Astrolabe",
    source: "gemini",
    brief:
      "Petite sphère + 3 anneaux orbitaux orientés différemment. Vitesse de rotation x3 au hover.",
    Component: AstrolabeCore,
  },
  {
    id: "morphing-blob",
    label: "Morphing Blob",
    source: "gemini",
    brief:
      "Sphère avec MeshDistortMaterial. Distortion + speed augmentent au hover et au focus.",
    Component: MorphingBlobCore,
  },
  {
    id: "wireframe-nexus",
    label: "Wireframe Nexus",
    source: "gemini",
    brief:
      "Icosaèdre wireframe extérieur + sphère wireframe interne contre-rotative. Style technique.",
    Component: WireframeNexusCore,
  },
] as const;

export const DEFAULT_VARIANT_ID = "original";

export function getVariant(id: string): CoreVariant {
  return CORE_VARIANTS.find((v) => v.id === id) ?? CORE_VARIANTS[0];
}
