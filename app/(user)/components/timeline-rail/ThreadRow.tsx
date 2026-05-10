/**
 * ThreadRow — ligne d'un thread dans une section (Investigations / Archive).
 *
 * Click sur la row → onSelect (=> handleThreadSelect : setActiveThread +
 * setStageMode chat). Boutons archive/delete en hover, stopPropagation
 * pour ne pas déclencher la sélection.
 */

import type { Thread } from "@/stores/navigation";
import { ArchiveIcon, TrashIcon } from "./icons";

export interface ThreadRowProps {
  thread: Thread;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onArchive: () => void;
}

export function ThreadRow({ thread, isActive, onSelect, onDelete, onArchive }: ThreadRowProps) {
  const isArchived = thread.archived === true;
  return (
    <div
      onClick={onSelect}
      className={`group cursor-pointer py-2 px-3 transition-colors duration-(--duration-base) ease-(--ease-out-soft) flex items-center gap-3 rounded-md ${
        isActive ? "bg-[var(--layer-1)]" : "hover:bg-[var(--layer-1)]"
      }`}
      title={thread.name}
    >
      <span
        className="rounded-pill shrink-0"
        style={{
          width: "var(--space-2)",
          height: "var(--space-2)",
          background: "var(--accent-teal)",
          boxShadow: isActive ? "var(--shadow-neon-accent-teal)" : "none",
          opacity: isActive ? 1 : 0.55,
        }}
        aria-hidden
      />
      <p
        className="flex-1 t-14 truncate min-w-0 transition-all duration-(--duration-slow) ease-(--ease-out-soft)"
        style={{
          lineHeight: "var(--leading-base)",
          color: isActive ? "var(--accent-teal)" : "var(--text-l1)",
          fontWeight: isActive ? "var(--weight-medium)" : "var(--weight-light)",
          textShadow: isActive ? "var(--shadow-neon-accent-teal)" : "none",
        }}
      >
        {thread.name}
      </p>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 shrink-0 flex items-center gap-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onArchive();
          }}
          className="text-text-faint hover:text-text-soft p-1 transition-colors"
          title={isArchived ? "Désarchiver" : "Archiver"}
          aria-label={isArchived ? "Désarchiver la conversation" : "Archiver la conversation"}
        >
          <ArchiveIcon />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="text-text-faint hover:text-(--danger) p-1 transition-colors"
          title="Supprimer"
          aria-label="Supprimer la conversation"
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}
