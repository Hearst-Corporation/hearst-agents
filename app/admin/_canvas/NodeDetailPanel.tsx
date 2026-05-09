/** TODO stub — voir docs/AGENT-DRIVEN-DEV.md
 *
 * Panneau de détail d'un node sélectionné. Stub composant placeholder.
 * À implémenter : header label, métriques live, last events, actions debug.
 */

"use client";

import type { CanvasNode } from "./topology";

interface Props {
  node: CanvasNode | null;
  onClear: () => void;
}

export default function NodeDetailPanel({ node, onClear }: Props) {
  if (!node) {
    return (
      <div
        data-stub="NodeDetailPanel"
        className="flex-1 flex items-center justify-center t-13 text-text-faint"
      >
        Aucun stage sélectionné
      </div>
    );
  }
  return (
    <div data-stub="NodeDetailPanel" className="flex-1 flex flex-col p-(--space-4) gap-(--space-3)">
      <header className="flex items-center justify-between">
        <span className="t-13 font-medium text-text">{node.label}</span>
        <button
          type="button"
          onClick={onClear}
          className="t-10 font-mono uppercase tracking-(--tracking-stretch) text-text-muted hover:text-text"
        >
          fermer
        </button>
      </header>
      <p className="t-11 text-text-muted">Détails (stub)</p>
    </div>
  );
}
