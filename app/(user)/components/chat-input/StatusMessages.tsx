"use client";

import type { InlineGenStatus } from "./types";

interface StatusMessagesProps {
  uploadError: string | null;
  imageGenStatus: InlineGenStatus;
  imageGenMessage: string | null;
  audioGenStatus: InlineGenStatus;
  audioGenMessage: string | null;
  codeExecStatus: InlineGenStatus;
  codeExecMessage: string | null;
  docParseMessage: string | null;
}

/**
 * Empile les messages d'état éphémères affichés au-dessus du textarea :
 * upload PDF (error), génération image/audio/code (pending/success/error),
 * parse document (success). Couleurs : danger ou accent-teal.
 */
export function StatusMessages({
  uploadError,
  imageGenStatus,
  imageGenMessage,
  audioGenStatus,
  audioGenMessage,
  codeExecStatus,
  codeExecMessage,
  docParseMessage,
}: StatusMessagesProps) {
  return (
    <>
      {uploadError && <p className="t-10 tracking-wide text-(--danger) px-1 pb-3">{uploadError}</p>}
      {imageGenMessage && (
        <p
          className={`t-10 tracking-wide px-1 pb-3 ${
            imageGenStatus === "error" ? "text-(--danger)" : "text-(--accent-teal)"
          }`}
        >
          {imageGenMessage}
        </p>
      )}
      {audioGenMessage && (
        <p
          className={`t-10 tracking-wide px-1 pb-3 ${
            audioGenStatus === "error" ? "text-(--danger)" : "text-(--accent-teal)"
          }`}
        >
          {audioGenMessage}
        </p>
      )}
      {codeExecMessage && (
        <p
          className={`t-10 tracking-wide px-1 pb-3 ${
            codeExecStatus === "error" ? "text-(--danger)" : "text-(--accent-teal)"
          }`}
        >
          {codeExecMessage}
        </p>
      )}
      {docParseMessage && (
        <p className="t-10 tracking-wide px-1 pb-3 text-(--accent-teal)">{docParseMessage}</p>
      )}
    </>
  );
}
