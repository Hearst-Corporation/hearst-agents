"use client";

import { useCallback, useState } from "react";

interface UseAssetActionsParams {
  assetId: string;
  assetTitle: string | undefined;
  onAfterDelete: () => void;
}

interface UseAssetActionsResult {
  actionMsg: string | null;
  confirmDelete: boolean;
  setConfirmDelete: (v: boolean) => void;
  deleting: boolean;
  promptCopied: boolean;
  handleRerun: () => void;
  handleExport: () => void;
  handleShare: () => void;
  handleDelete: () => Promise<void>;
  handleCopyPrompt: (prompt: string) => Promise<void>;
}

const TOAST_DURATION_MS = 3000;
const COPY_FEEDBACK_DURATION_MS = 2000;
const SHARE_TTL_HOURS = 168;

/**
 * Hook unique pour les actions d'un asset (Re-run / Export PDF / Partager /
 * Supprimer / Copier prompt) + gestion du toast de retour.
 *
 * Toutes les requêtes restent best-effort : l'utilisateur récupère un
 * retour visuel quoi qu'il arrive.
 */
export function useAssetActions({
  assetId,
  assetTitle,
  onAfterDelete,
}: UseAssetActionsParams): UseAssetActionsResult {
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);

  const flash = useCallback((msg: string) => {
    setActionMsg(msg);
    window.setTimeout(() => setActionMsg(null), TOAST_DURATION_MS);
  }, []);

  const handleCopyPrompt = useCallback(
    async (prompt: string) => {
      try {
        await navigator.clipboard.writeText(prompt);
        setPromptCopied(true);
        window.setTimeout(() => setPromptCopied(false), COPY_FEEDBACK_DURATION_MS);
      } catch {
        flash("Impossible de copier");
      }
    },
    [flash],
  );

  const handleRerun = useCallback(() => {
    // POST /api/reports/[id]/rerun (stub) — fallback toast si non
    // implémenté.
    void fetch(`/api/reports/${encodeURIComponent(assetId)}/rerun`, {
      method: "POST",
      credentials: "include",
    })
      .then(async (r) => {
        if (r.status === 404) {
          flash("Re-run non disponible pour cet asset");
          return;
        }
        if (!r.ok) {
          flash(`Erreur Re-run · HTTP ${r.status}`);
          return;
        }
        flash("Re-run lancé");
      })
      .catch(() => flash("Re-run injoignable"));
  }, [assetId, flash]);

  const handleExport = useCallback(() => {
    const url = `/api/reports/${encodeURIComponent(assetId)}/export?format=pdf`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${assetTitle ?? "report"}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [assetId, assetTitle]);

  const handleShare = useCallback(() => {
    void fetch(`/api/reports/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ assetId, ttlHours: SHARE_TTL_HOURS }),
    })
      .then(async (r) => {
        if (!r.ok) {
          flash(`Erreur partage · HTTP ${r.status}`);
          return;
        }
        const json = (await r.json()) as { shareUrl?: string };
        if (json.shareUrl) {
          await navigator.clipboard?.writeText(json.shareUrl);
          flash("Lien copié dans le presse-papiers");
        }
      })
      .catch(() => flash("Partage injoignable"));
  }, [assetId, flash]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      const r = await fetch(`/api/v2/assets/${encodeURIComponent(assetId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) {
        flash(`Erreur suppression · HTTP ${r.status}`);
        return;
      }
      setConfirmDelete(false);
      onAfterDelete();
    } finally {
      setDeleting(false);
    }
  }, [assetId, flash, onAfterDelete]);

  return {
    actionMsg,
    confirmDelete,
    setConfirmDelete,
    deleting,
    promptCopied,
    handleRerun,
    handleExport,
    handleShare,
    handleDelete,
    handleCopyPrompt,
  };
}
