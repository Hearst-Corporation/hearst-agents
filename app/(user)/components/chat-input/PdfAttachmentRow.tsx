"use client";

import type { PdfAttachment } from "./types";

interface PdfAttachmentRowProps {
  attachment: PdfAttachment;
  onRemove: () => void;
}

/**
 * Ligne d'aperçu du PDF parsé attaché au composer (filename + nb pages).
 * Bouton "×" retire l'attachment.
 */
export function PdfAttachmentRow({
  attachment,
  onRemove,
}: PdfAttachmentRowProps) {
  return (
    <div className="flex items-center gap-3 px-1 pb-4 mb-4 border-b border-(--line)">
      <span className="t-9 font-medium text-(--accent-teal)">PDF</span>
      <span className="t-13 text-text-muted truncate max-w-xs font-light">
        {attachment.fileName}
      </span>
      <span className="t-9 font-mono tabular-nums text-text-ghost">
        {attachment.pageCount}P
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="ml-auto t-13 text-text-ghost hover:text-(--danger) transition-colors"
        aria-label="Retirer le document"
      >
        ×
      </button>
    </div>
  );
}
