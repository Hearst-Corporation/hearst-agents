"use client";

/**
 * ContextChips — affiche les chips de contexte actives au-dessus de
 * l'input du Thinking Canvas. Lit directement le store `useChatContext`.
 *
 * - 0 chip → ne rend rien (no flash).
 * - Click sur le label → émet `chat-context:focus` (custom event) avec
 *   `{ id, kind }` ; les autres lots peuvent l'écouter pour focaliser
 *   l'élément lié (asset, mission, rapport…).
 * - Click sur la croix → retire le chip via `removeChip`.
 *   Un undo inline (4 s) permet de rétablir le chip retiré par erreur.
 */

import { useRef, useState } from "react";
import { Action, IconButton } from "@/app/(user)/components/ui";
import type { ContextChip } from "@/stores/chat-context";
import { useChatContext } from "@/stores/chat-context";

export function ContextChips() {
  const chips = useChatContext((s) => s.chips);
  const removeChip = useChatContext((s) => s.removeChip);
  const addChip = useChatContext((s) => s.addChip);

  // Undo suppression chip : stocke temporairement le dernier chip retiré.
  const [undoChip, setUndoChip] = useState<ContextChip | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleRemove = (chip: ContextChip) => {
    removeChip(chip.id);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoChip(chip);
    undoTimerRef.current = setTimeout(() => setUndoChip(null), 4000);
  };

  const handleUndo = () => {
    if (!undoChip) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    addChip(undoChip);
    setUndoChip(null);
  };

  if (chips.length === 0 && !undoChip) return null;

  return (
    <div data-testid="context-chips" className="flex flex-row flex-wrap gap-2 mb-3">
      {chips.map((chip) => (
        <span
          key={chip.id}
          data-testid={`context-chip-${chip.id}`}
          className="group inline-flex items-center gap-2 rounded-pill border border-(--border-shell) bg-surface-1 hover:bg-surface-2 transition-colors duration-base"
          style={{ padding: "var(--space-2) var(--space-3)" }}
        >
          <button
            type="button"
            onClick={() => {
              if (typeof window === "undefined") return;
              window.dispatchEvent(
                new CustomEvent("chat-context:focus", {
                  detail: { id: chip.id, kind: chip.kind },
                }),
              );
            }}
            className="t-11 font-light text-text-muted hover:text-text-soft transition-colors"
            data-testid={`context-chip-label-${chip.id}`}
          >
            {chip.label}
          </button>
          <IconButton
            icon={
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                <path d="M2 2 L8 8 M8 2 L2 8" />
              </svg>
            }
            label={`Retirer ${chip.label}`}
            tone="muted"
            size="xs"
            onClick={() => handleRemove(chip)}
            testId={`context-chip-remove-${chip.id}`}
          />
        </span>
      ))}

      {/* Undo pill — visible 4 s après suppression */}
      {undoChip && (
        <span
          className="inline-flex items-center gap-2 rounded-pill border border-(--border-shell) bg-surface-1"
          style={{ padding: "var(--space-2) var(--space-3)" }}
        >
          <span className="t-11 font-light text-text-ghost">{undoChip.label} retiré.</span>
          <Action variant="ghost" tone="neutral" size="sm" onClick={handleUndo}>
            Rétablir
          </Action>
        </span>
      )}
    </div>
  );
}
