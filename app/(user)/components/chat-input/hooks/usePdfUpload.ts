"use client";

import { useCallback, useRef, useState } from "react";
import type { PdfAttachment } from "../types";

const UPLOAD_ERROR_RESET_MS = 4000;

/**
 * Upload PDF + parsing serveur (`/api/v2/documents/upload`).
 * Conserve `attachment` jusqu'à submit ou retrait manuel.
 */
export function usePdfUpload() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachment, setAttachment] = useState<PdfAttachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
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
          setUploadError("PDF parsing failed");
          setTimeout(() => setUploadError(null), UPLOAD_ERROR_RESET_MS);
        })
        .finally(() => setUploading(false));
    },
    [],
  );

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
