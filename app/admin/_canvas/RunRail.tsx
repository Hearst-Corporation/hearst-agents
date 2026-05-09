/** TODO stub — voir docs/AGENT-DRIVEN-DEV.md
 *
 * Rail de runs persistés (sélection → replay). Stub composant placeholder.
 * À implémenter : fetch /api/admin/runs, liste virtualisée, click → onSelect(runId).
 */

"use client";

interface Props {
  onSelect: (runId: string) => void;
}

export default function RunRail({ onSelect: _onSelect }: Props) {
  return (
    <div
      data-stub="RunRail"
      className="flex-1 flex items-center justify-center t-13 text-text-faint"
    >
      Runs (stub)
    </div>
  );
}
