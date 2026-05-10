"use client";

import type { RefObject } from "react";
import { AutoPill } from "./AutoPill";
import type { InlineGenStatus, PdfAttachment } from "./types";

interface ComposerActionsProps {
  input: string;
  isRunning: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  attachment: PdfAttachment | null;
  uploading: boolean;
  imageGenStatus: InlineGenStatus;
  audioGenStatus: InlineGenStatus;
  codeExecStatus: InlineGenStatus;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onTriggerFilePicker: () => void;
  onAudioGen: () => void;
  onCodeExec: () => void;
  onImageGen: () => void;
  onOpenDocParse: () => void;
  onSubmit: () => void;
}

/**
 * Rangée d'actions sous le textarea. Affichée uniquement si composer expanded.
 * Ordre des icônes : AutoPill, audio, code, image, document parse, attach PDF, send/spinner.
 */
export function ComposerActions({
  input,
  isRunning,
  fileInputRef,
  attachment,
  uploading,
  imageGenStatus,
  audioGenStatus,
  codeExecStatus,
  onFileChange,
  onTriggerFilePicker,
  onAudioGen,
  onCodeExec,
  onImageGen,
  onOpenDocParse,
  onSubmit,
}: ComposerActionsProps) {
  return (
    <div className="flex items-center justify-end gap-3 pt-2">
      <AutoPill />
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={onFileChange}
      />
      <button
        type="button"
        onClick={onAudioGen}
        disabled={!input.trim() || audioGenStatus === "pending" || isRunning}
        title={
          audioGenStatus === "pending"
            ? "Synthèse en cours…"
            : "Synthétiser le texte en audio"
        }
        aria-label="Synthétiser en audio"
        className={`transition-colors duration-base ${
          audioGenStatus === "pending"
            ? "text-(--warn) animate-pulse"
            : audioGenStatus === "error"
              ? "text-(--danger)"
              : input.trim()
                ? "text-(--text-l2) hover:text-(--accent-teal)"
                : "text-(--text-l3) cursor-not-allowed"
        }`}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M11 5L6 9H2v6h4l5 4V5z" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
        </svg>
      </button>
      <button
        type="button"
        onClick={onCodeExec}
        disabled={!input.trim() || codeExecStatus === "pending" || isRunning}
        title={
          codeExecStatus === "pending"
            ? "Exécution en cours…"
            : "Exécuter du code dans la sandbox"
        }
        aria-label="Exécuter le code"
        className={`transition-colors duration-base ${
          codeExecStatus === "pending"
            ? "text-(--warn) animate-pulse"
            : codeExecStatus === "error"
              ? "text-(--danger)"
              : input.trim()
                ? "text-(--text-l2) hover:text-(--accent-teal)"
                : "text-(--text-l3) cursor-not-allowed"
        }`}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      </button>
      <button
        type="button"
        onClick={onImageGen}
        disabled={!input.trim() || imageGenStatus === "pending" || isRunning}
        title={
          imageGenStatus === "pending"
            ? "Génération en cours…"
            : "Générer une image depuis le prompt"
        }
        aria-label="Générer une image"
        className={`transition-colors duration-base ${
          imageGenStatus === "pending"
            ? "text-(--warn) animate-pulse"
            : imageGenStatus === "error"
              ? "text-(--danger)"
              : input.trim()
                ? "text-(--text-l2) hover:text-(--accent-teal)"
                : "text-(--text-l3) cursor-not-allowed"
        }`}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="9" cy="9" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      </button>
      <button
        type="button"
        onClick={onOpenDocParse}
        disabled={isRunning}
        title="Parser un document depuis une URL (LlamaParse)"
        aria-label="Parser un document"
        data-testid="chat-input-document-parse"
        className={`transition-colors duration-base ${
          isRunning
            ? "text-(--text-l3) cursor-not-allowed"
            : "text-(--text-l2) hover:text-(--accent-teal)"
        }`}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="9" y1="13" x2="15" y2="13" />
          <line x1="9" y1="17" x2="15" y2="17" />
        </svg>
      </button>
      <button
        type="button"
        onClick={onTriggerFilePicker}
        disabled={uploading || isRunning}
        title={uploading ? "Parsing en cours…" : "Joindre un PDF"}
        aria-label="Joindre un PDF"
        className={`transition-colors duration-base ${
          uploading
            ? "text-(--warn) animate-pulse"
            : attachment
              ? "text-(--accent-teal)"
              : "text-(--text-l2) hover:text-(--accent-teal)"
        }`}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </svg>
      </button>
      {isRunning ? (
        <div className="w-5 h-5 flex items-center justify-center shrink-0">
          <div className="w-3 h-3 border border-(--border-subtle) border-t-[var(--accent-teal)] rounded-full animate-spin" />
        </div>
      ) : (
        <button
          onClick={onSubmit}
          disabled={!input.trim()}
          aria-label="Envoyer"
          className={`transition-colors duration-base ${
            input.trim()
              ? "text-(--accent-teal)"
              : "text-(--text-l3) cursor-not-allowed hover:text-(--text-l2)"
          }`}
          title="Envoyer"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </div>
  );
}
