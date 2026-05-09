/**
 * Légende compacte du pipeline — 2 branches (main / agent) avec leur couleur.
 *
 * Affichée dans l'action strip de CanvasShell, à côté du toggle live. Inline,
 * voix régulière FR (pas de mono caps), trait swatch tokenisé.
 */

"use client";

interface BranchEntry {
  id: "main" | "agent";
  label: string;
  color: string;
}

const BRANCHES: BranchEntry[] = [
  { id: "main", label: "Main", color: "var(--accent-teal)" },
  { id: "agent", label: "Agent", color: "var(--accent-agent)" },
];

export default function FlowLegend() {
  return (
    <ul
      className="flex items-center gap-(--space-3) t-10 font-mono uppercase tracking-(--tracking-stretch) text-text-faint"
      aria-label="Légende des branches du pipeline"
    >
      {BRANCHES.map((b) => (
        <li key={b.id} className="flex items-center gap-(--space-2)">
          <span
            aria-hidden="true"
            className="block h-px w-(--space-5) rounded-(--radius-pill)"
            style={{ backgroundColor: b.color }}
          />
          <span>{b.label}</span>
        </li>
      ))}
    </ul>
  );
}
