"use client";

import { lazy, Suspense } from "react";
import { useNavigationStore } from "@/stores/navigation";
import { useRuntimeStore } from "@/stores/runtime";
import { useStageStore } from "@/stores/stage";
import { ContextChips } from "../chat/ContextChips";
import { AttachedAssetChips } from "./AttachedAssetChips";
import { useAttachedAssets } from "./hooks/useAttachedAssets";
import { useChatComposer } from "./hooks/useChatComposer";
import { useDocumentParseModal } from "./hooks/useDocumentParseModal";
import { useInlineGen } from "./hooks/useInlineGen";
import { useMentionTypeahead } from "./hooks/useMentionTypeahead";
import { usePdfUpload } from "./hooks/usePdfUpload";
import { MentionTypeahead } from "./MentionTypeahead";
import { PdfAttachmentRow } from "./PdfAttachmentRow";
import { StatusMessages } from "./StatusMessages";
import type { ChatInputProps } from "./types";
import { resolvePlaceholder } from "./utils/surfacePlaceholders";

/**
 * Placeholders du composer selon le mode stage actif.
 * Remplace l'ancien système `surface` (navigation store) qui ne changeait
 * jamais sur le shell visionOS.
 */
const MODE_PLACEHOLDERS: Record<string, string> = {
  cockpit: "Demande quelque chose à Hearst…",
  chat: "Pose ta question…",
  asset: "Demande sur cet asset…",
  asset_compare: "Compare ces assets…",
  mission: "Donne des instructions pour la mission…",
  browser: "Que veux-tu faire sur cette page ?",
  meeting: "Résume ce meeting…",
  kg: "Explore le graphe de connaissances…",
  voice: "Parle à Hearst…",
  simulation: "Lance un scénario de simulation…",
  artifact: "Demande du code ou un artefact…",
  signal: "Analyse les signaux…",
};

function resolveModePlaceholder(mode: string, surface: string, override?: string): string {
  if (override) return override;
  return MODE_PLACEHOLDERS[mode] || resolvePlaceholder(surface, undefined);
}

// Lazy-load : modal rendu uniquement à la première ouverture (gain bundle
// initial du chat ~5-8 KB selon le contenu de DocumentParseModal).
const DocumentParseModal = lazy(() =>
  import("../DocumentParseModal").then((m) => ({
    default: m.DocumentParseModal,
  })),
);

/**
 * ChatInput — composer du chat (orchestrateur).
 *
 * Délègue la logique aux hooks (composer, mentions, attachments, upload PDF,
 * gen inline, doc parse modal) et le rendu aux sous-composants.
 *
 * Invariants ADD chat respectés :
 *  - I-17 : assets passés par référence (`attachedAssetIds` au submit, jamais inlinés).
 *  - I-3 : aucun nouvel event SSE émis ici (les générations inline passent par
 *          des endpoints dédiés `/api/v2/jobs/*`, pas l'orchestrate).
 */
export function ChatInput({
  onSubmit,
  placeholder,
  connectedServices = [],
  onProviderMention,
}: ChatInputProps) {
  const isRunning = useRuntimeStore((s) => s.coreState !== "idle");
  const surface = useNavigationStore((s) => s.surface);
  const stageMode = useStageStore((s) => s.current.mode);

  const { input, setInput, setInputFocused, inputRef } = useChatComposer();

  const {
    typeaheadRef,
    showTypeahead,
    typeaheadQuery,
    matchingServices,
    selectService,
    setHideTypeahead,
  } = useMentionTypeahead({
    input,
    setInput,
    inputRef,
    connectedServices,
    onProviderMention,
  });

  const {
    attachedAssets,
    isDragOver,
    handleAssetDrop,
    handleAssetDragOver,
    handleAssetDragLeave,
    removeAttachedAsset,
    resetAttachedAssets,
  } = useAttachedAssets({ setInput, inputRef });

  const { fileInputRef, attachment, uploadError, handleFileChange, clearAttachment, resetUpload } =
    usePdfUpload();

  const {
    imageGenStatus,
    imageGenMessage,
    audioGenStatus,
    audioGenMessage,
    codeExecStatus,
    codeExecMessage,
  } = useInlineGen({ input, setInput });

  const { docParseOpen, docParseMessage, closeModal, handleSuccess } = useDocumentParseModal();

  function handleSubmit() {
    if (!input.trim() || isRunning) return;
    const finalMessage = attachment
      ? `Parsed document (${attachment.fileName}, ${attachment.pageCount} pages):\n\n${attachment.text}\n\n---\n\n${input.trim()}`
      : input.trim();
    const attachedAssetIds = attachedAssets.map((a) => a.assetId);
    onSubmit(finalMessage, attachedAssetIds.length > 0 ? { attachedAssetIds } : undefined);
    setInput("");
    resetUpload();
    resetAttachedAssets();
    setHideTypeahead(true);
  }

  return (
    <form
      aria-label="Envoyer un message"
      aria-busy={isRunning}
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
      className="relative w-full animate-[panel-slide-in-bottom_0.6s_ease-out] flex justify-center pb-12"
    >
      <div
        className="relative flex items-center group transition-colors duration-500 border-b border-white/10 focus-within:border-white/30"
        style={{
          background: "transparent",
          padding: "var(--space-2) 0",
          width: "100%",
          maxWidth: "var(--space-42-5)",
          minHeight: "var(--space-10)",
        }}
        onDragOver={handleAssetDragOver}
        onDragLeave={handleAssetDragLeave}
        onDrop={handleAssetDrop}
        data-drag-over={isDragOver}
      >
        <div className="relative flex items-center w-full flex-1">
          <div className="absolute bottom-full left-0 mb-4 flex flex-col gap-2 w-full">
            {showTypeahead && (
              <MentionTypeahead
                typeaheadRef={typeaheadRef}
                matchingServices={matchingServices}
                typeaheadQuery={typeaheadQuery}
                onSelect={selectService}
              />
            )}
            <ContextChips />
            <AttachedAssetChips attachedAssets={attachedAssets} onRemove={removeAttachedAsset} />
            {attachment && <PdfAttachmentRow attachment={attachment} onRemove={clearAttachment} />}
            <StatusMessages
              uploadError={uploadError}
              imageGenStatus={imageGenStatus}
              imageGenMessage={imageGenMessage}
              audioGenStatus={audioGenStatus}
              audioGenMessage={audioGenMessage}
              codeExecStatus={codeExecStatus}
              codeExecMessage={codeExecMessage}
              docParseMessage={docParseMessage}
            />
          </div>

          <input
            ref={inputRef as any}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            aria-busy={isRunning}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (showTypeahead && matchingServices.length > 0) {
                  selectService(matchingServices[0]);
                } else {
                  handleSubmit();
                }
              }
              if (e.key === "Escape") {
                setHideTypeahead(true);
              }
            }}
            placeholder={
              stageMode === "cockpit"
                ? "Que devons-nous décider ? _"
                : resolveModePlaceholder(stageMode, surface, placeholder)
            }
            className="w-full bg-transparent border-none outline-none text-white/80 t-15 placeholder:text-white/30 font-light caret-white"
          />

          {/* Spinner inline pendant un run actif (aria-busy parent). */}
          {isRunning && (
            <span
              aria-hidden="true"
              className="animate-pulse text-white/40 t-15 font-light shrink-0"
              style={{ marginLeft: "var(--space-2)" }}
            >
              ⋯
            </span>
          )}
        </div>
      </div>

      {docParseOpen && (
        <Suspense fallback={null}>
          <DocumentParseModal open={docParseOpen} onClose={closeModal} onSuccess={handleSuccess} />
        </Suspense>
      )}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileChange}
        accept="application/pdf"
      />
    </form>
  );
}
