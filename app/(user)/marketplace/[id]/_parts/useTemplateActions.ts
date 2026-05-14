"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/app/hooks/use-toast";
import type {
  MarketplaceTemplate,
  MarketplaceRating,
  CreativePromptPayload,
} from "@/lib/marketplace/types";

export interface DetailResponse {
  template: MarketplaceTemplate;
  ratings: MarketplaceRating[];
}

export function useTemplateActions(
  id: string,
  data: DetailResponse | null,
  setData: (d: DetailResponse) => void,
) {
  const router = useRouter();
  const [flash, setFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleClone() {
    setBusy(true);
    setFlash(null);
    try {
      const res = await fetch(`/api/v2/marketplace/templates/${id}/clone`, {
        method: "POST",
        credentials: "include",
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        resourceId?: string;
        error?: string;
      };
      if (!res.ok || !body.ok) {
        const msg = body.error ?? `HTTP ${res.status}`;
        toast.error("Clone échoué", msg);
        setFlash(`Clone échoué : ${msg}`);
        return;
      }
      toast.success("Template cloné", "La copie est ouverte dans ton espace.");
      const focus = body.resourceId ? `?focus=${encodeURIComponent(body.resourceId)}` : "";
      if (data?.template.kind === "workflow") {
        router.push(`/missions${focus}`);
      } else if (data?.template.kind === "report_spec") {
        router.push(body.resourceId ? `/reports/studio?edit=${encodeURIComponent(body.resourceId)}` : "/reports");
      } else if (data?.template.kind === "persona") {
        router.push(`/personas${focus}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "clone_failed";
      toast.error("Clone échoué", msg);
      setFlash(msg);
    } finally {
      setBusy(false);
    }
  }

  async function handleRate(rating: number, comment: string) {
    if (rating < 1 || rating > 5) return;
    setBusy(true);
    setFlash(null);
    try {
      const res = await fetch(`/api/v2/marketplace/templates/${id}/rate`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rating, comment: comment.trim() || undefined }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        const msg = body.error ?? `HTTP ${res.status}`;
        toast.error("Note échouée", msg);
        setFlash(`Note échouée : ${msg}`);
        return;
      }
      toast.success("Merci pour la note", "Ta note a été enregistrée.");
      setFlash("Merci pour la note.");
      const fresh = await fetch(`/api/v2/marketplace/templates/${id}`, { credentials: "include" });
      if (fresh.ok) {
        const body = (await fresh.json()) as DetailResponse;
        setData(body);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleUseCreativePack() {
    if (!data || data.template.kind !== "creative_prompt") return;
    const payload = data.template.payload as CreativePromptPayload;
    setBusy(true);
    setFlash(null);
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(payload.prompt);
        setFlash("Prompt copié dans le presse-papiers — colle-le dans VideoQuickLaunch ou AssetVariantTabs.");
      } else {
        setFlash("Prompt prêt — copie manuelle requise (clipboard indisponible).");
      }
    } catch (e) {
      setFlash(e instanceof Error ? e.message : "copy_failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleReport(reportReason: string, onSuccess: () => void) {
    if (reportReason.trim().length < 3) return;
    setBusy(true);
    setFlash(null);
    try {
      const res = await fetch(`/api/v2/marketplace/templates/${id}/report`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: reportReason.trim() }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setFlash(`Signalement échoué : ${body.error ?? res.status}`);
        return;
      }
      setFlash("Signalement envoyé.");
      onSuccess();
    } finally {
      setBusy(false);
    }
  }

  return { flash, busy, handleClone, handleRate, handleUseCreativePack, handleReport };
}
