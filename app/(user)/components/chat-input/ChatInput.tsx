"use client";

import { Suspense, lazy } from "react";
import { useRuntimeStore } from "@/stores/runtime";
import { useNavigationStore } from "@/stores/navigation";
import { ContextChips } from "../chat/ContextChips";
import { AttachedAssetChips } from "./AttachedAssetChips";
import { ComposerActions } from "./ComposerActions";
import { MentionTypeahead } from "./MentionTypeahead";
import { PdfAttachmentRow } from "./PdfAttachmentRow";
import { QuickMentionRow } from "./QuickMentionRow";
import { StatusMessages } from "./StatusMessages";
import { useAttachedAssets } from "./hooks/useAttachedAssets";
import { useChatComposer } from "./hooks/useChatComposer";
import { useDocumentParseModal } from "./hooks/useDocumentParseModal";
import { useInlineGen } from "./hooks/useInlineGen";
import { useMentionTypeahead } from "./hooks/useMentionTypeahead";
import { usePdfUpload } from "./hooks/usePdfUpload";
import { resolvePlaceholder } from "./utils/surfacePlaceholders";
import type { ChatInputProps } from "./types";

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

  const {
    input,
    setInput,
    setInputFocused,
    inputRef,
    isExpanded,
  } = useChatComposer();

  const {
    typeaheadRef,
    showTypeahead,
    typeaheadQuery,
    matchingServices,
    selectService,
    insertMentionFromIcon,
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

  const {
    fileInputRef,
    attachment,
    uploading,
    uploadError,
    handleFileChange,
    clearAttachment,
    triggerFilePicker,
    resetUpload,
  } = usePdfUpload();

  const {
    imageGenStatus,
    imageGenMessage,
    audioGenStatus,
    audioGenMessage,
    codeExecStatus,
    codeExecMessage,
    handleImageGen,
    handleAudioGen,
    handleCodeExec,
  } = useInlineGen({ input, setInput });

  const {
    docParseOpen,
    docParseMessage,
    openModal,
    closeModal,
    handleSuccess,
  } = useDocumentParseModal();

  function handleSubmit() {
    if (!input.trim() || isRunning) return;
    const finalMessage = attachment
      ? `Parsed document (${attachment.fileName}, ${attachment.pageCount} pages):\n\n${attachment.text}\n\n---\n\n${input.trim()}`
      : input.trim();
    const attachedAssetIds = attachedAssets.map((a) => a.assetId);
    onSubmit(
      finalMessage,
      attachedAssetIds.length > 0 ? { attachedAssetIds } : undefined,
    );
    setInput("");
    resetUpload();
    resetAttachedAssets();
    setHideTypeahead(true);
  }

  return (
    <div className="px-4 py-2">
      <div
        className="mx-auto relative"
        style={{ maxWidth: "var(--input-max-width)" }}
      >
        {showTypeahead && (
          <MentionTypeahead
            typeaheadRef={typeaheadRef}
            matchingServices={matchingServices}
            typeaheadQuery={typeaheadQuery}
            onSelect={selectService}
          />
        )}

        {/* Context chips au-dessus de l'input */}
        <div className="px-2">
          <ContextChips />
        </div>

        {/* Input "two-lines" — remplacé par vision-input (Apple Vision). */}
        <div
          className="vision-input peer group px-6 py-3 relative"
          onDragOver={handleAssetDragOver}
          onDragLeave={handleAssetDragLeave}
          onDrop={handleAssetDrop}
          data-drag-over={isDragOver}
        >
          <AttachedAssetChips
            attachedAssets={attachedAssets}
            onRemove={removeAttachedAsset}
          />

          {attachment && (
            <PdfAttachmentRow
              attachment={attachment}
              onRemove={clearAttachment}
            />
          )}

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

          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
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
            placeholder={resolvePlaceholder(surface, placeholder)}
            rows={1}
            className="block w-full bg-transparent t-18 font-light text-text placeholder:text-text-muted border-0 focus:ring-0 focus:outline-none resize-none leading-relaxed py-1"
            style={{
              minHeight: "var(--space-8)",
              maxHeight: "var(--height-input-max)",
            }}
          />

          <div className={isExpanded ? "" : "hidden"}>
            <ComposerActions
              input={input}
              isRunning={isRunning}
              fileInputRef={fileInputRef}
              attachment={attachment}
              uploading={uploading}
              imageGenStatus={imageGenStatus}
              audioGenStatus={audioGenStatus}
              codeExecStatus={codeExecStatus}
              onFileChange={handleFileChange}
              onTriggerFilePicker={triggerFilePicker}
              onAudioGen={handleAudioGen}
              onCodeExec={handleCodeExec}
              onImageGen={handleImageGen}
              onOpenDocParse={openModal}
              onSubmit={handleSubmit}
            />
          </div>
        </div>

        {/* Quick-mention apps — clic logo → @mention ; + vers /apps */}
        <QuickMentionRow
          connectedServices={connectedServices}
          onMention={insertMentionFromIcon}
        />
      </div>

      {docParseOpen && (
        <Suspense fallback={null}>
          <DocumentParseModal
            open={docParseOpen}
            onClose={closeModal}
            onSuccess={handleSuccess}
          />
        </Suspense>
      )}
    </div>
  );
}
