/**
 * CollapsedTile — tuile carrée 32×32 affichant l'initiale du thread
 * dans le rail collapsed. Limité à 12 entrées (I-5).
 */

import type { Thread } from "@/stores/navigation";

export interface CollapsedTileProps {
  thread: Thread;
  isActive: boolean;
  onSelect: () => void;
}

export function CollapsedTile({ thread, isActive, onSelect }: CollapsedTileProps) {
  const initial = thread.name.trim().charAt(0).toUpperCase() || "·";
  return (
    <button
      onClick={onSelect}
      title={thread.name}
      className={`touch-rail-tile relative w-8 h-8 flex items-center justify-center rounded-md t-13 font-light transition-colors duration-(--duration-slow) ease-(--ease-out-soft) shrink-0 ${
        isActive ? "is-active" : ""
      }`}
      aria-current={isActive ? "page" : undefined}
    >
      {initial}
    </button>
  );
}
