"use client";

import { useCallback, useState } from "react";

const SUCCESS_RESET_MS = 4000;

/**
 * Ouverture/fermeture du modal LlamaParse + message de confirmation
 * affiché au-dessus du textarea après lancement.
 */
export function useDocumentParseModal() {
  const [docParseOpen, setDocParseOpen] = useState(false);
  const [docParseMessage, setDocParseMessage] = useState<string | null>(null);

  const openModal = useCallback(() => setDocParseOpen(true), []);
  const closeModal = useCallback(() => setDocParseOpen(false), []);

  const handleSuccess = useCallback(() => {
    setDocParseMessage(
      "Document en parsing — il apparaîtra dans tes assets.",
    );
    setTimeout(() => setDocParseMessage(null), SUCCESS_RESET_MS);
  }, []);

  return {
    docParseOpen,
    docParseMessage,
    openModal,
    closeModal,
    handleSuccess,
  };
}
