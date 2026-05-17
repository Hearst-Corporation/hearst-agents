"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "@/app/hooks/use-toast";
import type { PdfAttachment } from "../types";

/**
 * Upload PDF + parsing serveur (`/api/v2/documents/upload`).
 * Conserve `attachment` jusqu'à submit ou retrait manuel.
 */
export function usePdfUpload() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachment, setAttachment] = useState<PdfAttachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";
    setUploading(true);
    fetch("/api/v2/documents/upload", {
      method: "POST",
      body: (() => {
        const fd = new FormData();
        fd.append("file", file);
        return fd;
      })(),
      credentials: "include",
    })
      .then(async (r) => {
        const data = (await r.json()) as {
          fileName?: string;
          text?: string;
          pageCount?: number;
          error?: string;
        };
        if (!r.ok) throw new Error(data.error ?? "Upload error");
        setAttachment({
          fileName: data.fileName ?? file.name,
          text: data.text ?? "",
          pageCount: data.pageCount ?? 0,
        });
      })
      .catch(() => {
        // T-C18 : toast persistant (pas d'auto-dismiss) — l'erreur d'upload
        // PDF doit rester visible jusqu'à dismiss explicite par l'user, c'est
        // une action coûteuse à relancer. Le toast manager actuel n'expose
        // pas `duration: 0`, mais ne purge que sur dismiss/clear → comportement
        // équivalent (le toast reste tant qu'aucun overflow MAX_TOASTS ne le
        // chasse). On garde aussi `uploadError` pour rétro-compatibilité du
        // composer (PdfAttachmentRow / StatusMessages s'y abonnent).
        setUploadError("PDF parsing failed");
        toast.error("Échec parsing PDF", "Réessaie ou vérifie le fichier.");
      })
      .finally(() => setUploading(false));
  }, []);

  const clearAttachment = useCallback(() => {
    setAttachment(null);
  }, []);

  const triggerFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const resetUpload = useCallback(() => {
    setAttachment(null);
    setUploading(false);
  }, []);

  return {
    fileInputRef,
    attachment,
    uploading,
    uploadError,
    handleFileChange,
    clearAttachment,
    triggerFilePicker,
    resetUpload,
  };
}
