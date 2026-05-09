/**
 * Topology canvas pipeline IA.
 *
 * 10 stages d'un run, flow gauche → droite, deux branches qui divergent à
 * `preflight` et reconvergent à `complete` :
 *
 *   entry → router → safety → intent → preflight → tools ──────────→ complete
 *                                          │                              ↑
 *                                          └→ agent → research → pipeline ┘
 *
 * Branche `main` (synchrone, top row) : preflight → tools → complete.
 * Branche `agent` (délégation multi-agents, bot row) : preflight → agent → research → pipeline → complete.
 *
 * Coordonnées : centre du node (x,y). ViewBox 1500×900 (aspect 1.67 — calé
 * sur l'aire dispo dans CanvasShell entre header strip et bas de viewport
 * desktop avec sidebar admin et aside ContextRail). Cards 240×180 — taille
 * minimum pour le grid CSS `.pipeline-card` (kicker / label / state pill).
 *
 * Ports : par défaut west (in) / east (out). Override sud/nord pour les
 * branchements verticaux (preflight → agent vers le bas, pipeline → complete vers le haut).
 */

export type NodeId =
  | "entry"
  | "router"
  | "safety"
  | "intent"
  | "preflight"
  | "tools"
  | "agent"
  | "research"
  | "pipeline"
  | "complete";

export type PortDirection = "north" | "south" | "east" | "west";

export interface CanvasNode {
  id: NodeId;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type EdgeBranch = "main" | "agent";

export interface CanvasEdge {
  id: string;
  from: NodeId;
  to: NodeId;
  /** "main" = chemin synchrone (teal), "agent" = délégation multi-agents (accent-agent). */
  branch: EdgeBranch;
  ports?: { in: PortDirection; out: PortDirection };
}

export interface Point {
  x: number;
  y: number;
}

const NODE_W = 240;
const NODE_H = 180;
const ROW_TOP = 280;
const ROW_BOTTOM = 700;
const STEP_X = 200;
const COL_X0 = 140;

export const VIEWBOX_W = COL_X0 + STEP_X * 6 + NODE_W / 2 + 20;
export const VIEWBOX_H = ROW_BOTTOM + NODE_H / 2 + 110;

/** Top row : main path (entry → tools) + complete (terminal alignment). */
const COL_ENTRY = COL_X0;
const COL_ROUTER = COL_X0 + STEP_X;
const COL_SAFETY = COL_X0 + STEP_X * 2;
const COL_INTENT = COL_X0 + STEP_X * 3;
const COL_PREFLIGHT = COL_X0 + STEP_X * 4;
const COL_TOOLS = COL_X0 + STEP_X * 5;
const COL_COMPLETE = COL_X0 + STEP_X * 6;

export const NODES: CanvasNode[] = [
  { id: "entry", label: "Entrée", x: COL_ENTRY, y: ROW_TOP, width: NODE_W, height: NODE_H },
  { id: "router", label: "Router", x: COL_ROUTER, y: ROW_TOP, width: NODE_W, height: NODE_H },
  { id: "safety", label: "Safety", x: COL_SAFETY, y: ROW_TOP, width: NODE_W, height: NODE_H },
  { id: "intent", label: "Intent", x: COL_INTENT, y: ROW_TOP, width: NODE_W, height: NODE_H },
  { id: "preflight", label: "Preflight", x: COL_PREFLIGHT, y: ROW_TOP, width: NODE_W, height: NODE_H },
  { id: "tools", label: "Outils", x: COL_TOOLS, y: ROW_TOP, width: NODE_W, height: NODE_H },
  { id: "complete", label: "Complete", x: COL_COMPLETE, y: ROW_TOP, width: NODE_W, height: NODE_H },
  { id: "agent", label: "Agent", x: COL_PREFLIGHT, y: ROW_BOTTOM, width: NODE_W, height: NODE_H },
  { id: "research", label: "Recherche", x: COL_TOOLS, y: ROW_BOTTOM, width: NODE_W, height: NODE_H },
  { id: "pipeline", label: "Pipeline", x: COL_COMPLETE, y: ROW_BOTTOM, width: NODE_W, height: NODE_H },
];

export const EDGES: CanvasEdge[] = [
  { id: "e_entry_router", from: "entry", to: "router", branch: "main" },
  { id: "e_router_safety", from: "router", to: "safety", branch: "main" },
  { id: "e_safety_intent", from: "safety", to: "intent", branch: "main" },
  { id: "e_intent_preflight", from: "intent", to: "preflight", branch: "main" },
  { id: "e_preflight_tools", from: "preflight", to: "tools", branch: "main" },
  { id: "e_tools_complete", from: "tools", to: "complete", branch: "main" },
  {
    id: "e_preflight_agent",
    from: "preflight",
    to: "agent",
    branch: "agent",
    ports: { out: "south", in: "north" },
  },
  { id: "e_agent_research", from: "agent", to: "research", branch: "agent" },
  { id: "e_research_pipeline", from: "research", to: "pipeline", branch: "agent" },
  {
    id: "e_pipeline_complete",
    from: "pipeline",
    to: "complete",
    branch: "agent",
    ports: { out: "north", in: "south" },
  },
];

const NODE_BY_ID: Record<NodeId, CanvasNode> = NODES.reduce(
  (acc, n) => {
    acc[n.id] = n;
    return acc;
  },
  {} as Record<NodeId, CanvasNode>,
);

export function getNode(id: NodeId): CanvasNode {
  const found = NODE_BY_ID[id];
  if (found) return found;
  return { id, label: id, x: 0, y: 0, width: 0, height: 0 };
}

/**
 * Si les nodes sont sur la même rangée (Δy < demi-hauteur node),
 * connexion horizontale est↔ouest. Sinon connexion verticale sud↔nord.
 */
export function edgePorts(
  from: CanvasNode,
  to: CanvasNode,
): { in: PortDirection; out: PortDirection } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const sameRow = Math.abs(dy) < (from.height + to.height) / 2;
  if (sameRow) {
    return dx >= 0 ? { out: "east", in: "west" } : { out: "west", in: "east" };
  }
  return dy >= 0 ? { out: "south", in: "north" } : { out: "north", in: "south" };
}

/** Point sur le bord du node selon la direction (x,y = centre du node). */
export function portAt(node: CanvasNode, dir: PortDirection): Point {
  const halfW = node.width / 2;
  const halfH = node.height / 2;
  switch (dir) {
    case "north":
      return { x: node.x, y: node.y - halfH };
    case "south":
      return { x: node.x, y: node.y + halfH };
    case "east":
      return { x: node.x + halfW, y: node.y };
    case "west":
      return { x: node.x - halfW, y: node.y };
  }
}

/**
 * Bézier cubique avec control points alignés sur les directions des ports
 * pour un raccord tangent au node. Offset proportionnel à la distance,
 * jamais < 60 pour rester lisible sur petits écarts.
 */
export function bezierPath(
  a: Point,
  outDir: PortDirection,
  b: Point,
  inDir: PortDirection,
): string {
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const offset = Math.max(60, dist * 0.45);
  const cp1 = offsetAlong(a, outDir, offset);
  const cp2 = offsetAlong(b, inDir, offset);
  return `M ${a.x} ${a.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${b.x} ${b.y}`;
}

function offsetAlong(p: Point, dir: PortDirection, d: number): Point {
  switch (dir) {
    case "north":
      return { x: p.x, y: p.y - d };
    case "south":
      return { x: p.x, y: p.y + d };
    case "east":
      return { x: p.x + d, y: p.y };
    case "west":
      return { x: p.x - d, y: p.y };
  }
}
