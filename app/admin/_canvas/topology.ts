/** TODO stub — voir docs/AGENT-DRIVEN-DEV.md
 *
 * Topology canvas pipeline IA. Stub auto-généré pour débloquer le typecheck CI.
 * À implémenter : nodes/edges réels, helpers bezier/ports, layout coordonnées.
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

export interface CanvasEdge {
  id: string;
  from: NodeId;
  to: NodeId;
  branch?: string;
  ports?: { in: PortDirection; out: PortDirection };
}

export interface Point {
  x: number;
  y: number;
}

/** TODO stub — liste vide pour l'instant, remplacer par la topologie réelle. */
export const NODES: CanvasNode[] = [];

/** TODO stub — liste vide pour l'instant, remplacer par les edges réels. */
export const EDGES: CanvasEdge[] = [];

/** TODO stub — retourne un node fantôme si non trouvé pour éviter null deref. */
export function getNode(id: NodeId): CanvasNode {
  const found = NODES.find((n) => n.id === id);
  if (found) return found;
  return { id, label: id, x: 0, y: 0, width: 0, height: 0 };
}

/** TODO stub — directions par défaut, à remplacer par calcul réel. */
export function edgePorts(
  _from: CanvasNode,
  _to: CanvasNode,
): { in: PortDirection; out: PortDirection } {
  return { in: "west", out: "east" };
}

/** TODO stub — retourne le centre du node. */
export function portAt(node: CanvasNode, _dir: PortDirection): Point {
  return { x: node.x, y: node.y };
}

/** TODO stub — path SVG droit entre a et b. */
export function bezierPath(
  a: Point,
  _outDir: PortDirection,
  b: Point,
  _inDir: PortDirection,
): string {
  return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
}
