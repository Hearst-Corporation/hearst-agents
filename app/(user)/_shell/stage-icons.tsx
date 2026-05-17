"use client";

/**
 * stage-icons — jeu d'icônes ligne (18px, currentColor) une par StageKey.
 *
 * Style silent-luxury : trait 1.5, pas de remplissage, géométrie sobre.
 * Consommé par LeftRail pour la navigation verticale des Stages.
 *
 * `asset_compare` est volontairement absent : c'est un mode contextuel
 * ouvert depuis le Stage Asset, pas une destination de premier niveau.
 */

import type { SVGProps } from "react";
import type { StageKey } from "../_stages/types";

type IconProps = SVGProps<SVGSVGElement>;

const BASE: IconProps = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

function Cockpit(p: IconProps) {
  return (
    <svg {...BASE} {...p}>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  );
}

function Chat(p: IconProps) {
  return (
    <svg {...BASE} {...p}>
      <path d="M4 5h16v11H8l-4 4V5z" />
    </svg>
  );
}

function Asset(p: IconProps) {
  return (
    <svg {...BASE} {...p}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 16l-5-5L5 21" />
    </svg>
  );
}

function Browser(p: IconProps) {
  return (
    <svg {...BASE} {...p}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18" />
      <circle cx="6" cy="6.5" r="0.6" fill="currentColor" />
      <circle cx="8.5" cy="6.5" r="0.6" fill="currentColor" />
    </svg>
  );
}

function Meeting(p: IconProps) {
  return (
    <svg {...BASE} {...p}>
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="M16 10l5-3v10l-5-3z" />
    </svg>
  );
}

function KG(p: IconProps) {
  return (
    <svg {...BASE} {...p}>
      <circle cx="6" cy="7" r="2" />
      <circle cx="18" cy="7" r="2" />
      <circle cx="12" cy="18" r="2" />
      <path d="M7.7 8.4l3 7.4M16.3 8.4l-3 7.4M8 7h8" />
    </svg>
  );
}

function Voice(p: IconProps) {
  return (
    <svg {...BASE} {...p}>
      <path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4" />
    </svg>
  );
}

function Simulation(p: IconProps) {
  return (
    <svg {...BASE} {...p}>
      <path d="M9 3v6l-5 9a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-5-9V3" />
      <path d="M8 3h8M7 14h10" />
    </svg>
  );
}

function Mission(p: IconProps) {
  return (
    <svg {...BASE} {...p}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.5" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" />
    </svg>
  );
}

function Artifact(p: IconProps) {
  return (
    <svg {...BASE} {...p}>
      <path d="M9 7l-5 5 5 5M15 7l5 5-5 5" />
    </svg>
  );
}

function Signal(p: IconProps) {
  return (
    <svg {...BASE} {...p}>
      <circle cx="12" cy="12" r="2" />
      <path d="M7.5 7.5a6 6 0 0 0 0 9M16.5 7.5a6 6 0 0 1 0 9M4.5 4.5a10 10 0 0 0 0 15M19.5 4.5a10 10 0 0 1 0 15" />
    </svg>
  );
}

function Connections(p: IconProps) {
  return (
    <svg {...BASE} {...p}>
      <circle cx="6" cy="6" r="2.4" />
      <circle cx="18" cy="6" r="2.4" />
      <circle cx="6" cy="18" r="2.4" />
      <circle cx="18" cy="18" r="2.4" />
      <path d="M8.4 6h7.2M6 8.4v7.2M18 8.4v7.2M8.4 18h7.2" />
    </svg>
  );
}

function AssetCompare(p: IconProps) {
  return (
    <svg {...BASE} {...p}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M12 4v16" />
    </svg>
  );
}

/** Map StageKey → composant icône. */
export const STAGE_ICON: Record<StageKey, (p: IconProps) => React.ReactElement> = {
  cockpit: Cockpit,
  chat: Chat,
  asset: Asset,
  asset_compare: AssetCompare,
  browser: Browser,
  meeting: Meeting,
  kg: KG,
  voice: Voice,
  simulation: Simulation,
  mission: Mission,
  artifact: Artifact,
  signal: Signal,
  connections: Connections,
};
