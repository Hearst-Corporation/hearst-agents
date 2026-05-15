// lint-visual-disable-file
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
      className={`group cursor-pointer py-2 px-3 transition-all duration-500 flex items-center gap-3 ${
        isActive 
          ? "bg-[rgba(255,255,255,0.06)] rounded-[12px] border border-[rgba(255,255,255,0.05)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]" 
          : "hover:bg-[rgba(255,255,255,0.03)] rounded-[12px] border border-transparent"
      }`}
      title={thread.name}
    >
      <span
        className="shrink-0 flex items-center justify-center"
        style={{
          width: "24px",
          height: "24px",
          background: isActive ? "rgba(var(--accent-llm-rgb, 167 139 250) / 0.15)" : "transparent",
          borderRadius: "6px",
        }}
        aria-hidden
      >
        <span
          style={{
            display: "inline-block",
            width: "12px",
            height: "12px",
            borderRadius: "50%",
            background: isActive ? "var(--accent-llm)" : "rgba(255, 255, 255, 0.3)",
            boxShadow: isActive ? "0 0 12px color-mix(in srgb, var(--accent-llm) 80%, transparent)" : "none",
          }}
        />
      </span>
      <p
        className="flex-1 truncate min-w-0 transition-colors duration-300 font-light"
        style={{
          fontSize: "14px",
          color: isActive ? "rgba(255, 255, 255, 0.95)" : "rgba(255, 255, 255, 0.55)",
          letterSpacing: "0.02em",
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
          className="text-[rgba(255,255,255,0.3)] hover:text-[rgba(255,255,255,0.8)] p-1 transition-colors"
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
          className="text-[rgba(255,255,255,0.3)] hover:text-[var(--danger)] p-1 transition-colors"
          title="Supprimer"
          aria-label="Supprimer la conversation"
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}
