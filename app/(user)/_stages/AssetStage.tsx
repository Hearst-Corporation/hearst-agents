"use client";

/**
 * AssetStage — consumer data-bound du run de génération média.
 *
 * Deux modes d'affichage selon `useStageStore.current` :
 *   - `mode === "asset" && assetId`   → fetch `/api/v2/assets/{id}` et
 *      affiche l'asset focal seul (cas Cmd+K → asset, lien chat, etc.)
 *   - sinon (mode "asset" sans id, ou mode parent) → fallback gallery
 *      `/api/v2/assets?limit=4` (anciens runs récents)
 *
 * Pousse les slots dans `useStageData.shellData` pour alimenter le
 * ContextRail. États couverts : loading, error, empty, populated. Voix
 * FR régulière, pas de mockup fallback.
 */

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { EmptyState, StageErrorBanner } from "@/app/(user)/components/ui";
import { sanitizeApiError } from "@/app/(user)/lib/sanitize-error";
import { useStageStore } from "@/stores/stage";
import { useStageData } from "@/stores/stage-data";
import { StageLayout } from "../_shell/StageLayout";
import { STAGE_REGISTRY } from "./registry";
import type { RailItem } from "./types";
import { VISION_EASE } from "./types";

// ── Types ────────────────────────────────────────────────────────────────────

type AssetMediaType = "video" | "image";

type AssetStatus = "running" | "ready" | "error";

interface AssetItem {
  id: string;
  title: string;
  type: AssetMediaType;
  status: AssetStatus;
  thumbnail?: string | undefined;
  tag: string;
}

interface ApiAsset {
  id: string;
  kind: string;
  title: string;
  contentRef?: string;
  summary?: string;
}

interface ApiAssetsResponse {
  assets: ApiAsset[];
}

// ── Démo dev-only ─────────────────────────────────────────────────────────────

const IS_DEV = process.env.NODE_ENV !== "production";

/** Jeu d'assets fictifs — affiché uniquement en dev quand aucune donnée réelle. */
const DEMO_ASSETS: AssetItem[] = [
  {
    id: "demo-asset-1",
    title: "Lancement campagne Q2 — teaser",
    type: "video",
    status: "ready",
    tag: "video",
  },
  {
    id: "demo-asset-2",
    title: "Visuel hero — page produit",
    type: "image",
    status: "ready",
    tag: "image",
  },
  {
    id: "demo-asset-3",
    title: "Synthèse marché — rapport client Acme",
    type: "image",
    status: "ready",
    tag: "report",
  },
  {
    id: "demo-asset-4",
    title: "Briefing du matin — note de cadrage",
    type: "image",
    status: "running",
    tag: "brief",
  },
  {
    id: "demo-asset-5",
    title: "Spot social — variante verticale",
    type: "video",
    status: "running",
    tag: "video",
  },
  {
    id: "demo-asset-6",
    title: "Bannière display — déclinaison FR",
    type: "image",
    status: "ready",
    tag: "image",
  },
];

// ── Variants ─────────────────────────────────────────────────────────────────

const SECTION_VARIANTS = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: VISION_EASE } },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const VIDEO_RE = /\.(mp4|webm|mov)(\?|$)/i;
const IMAGE_RE = /\.(jpg|jpeg|png|gif|webp|avif)(\?|$)/i;

/**
 * Normalise la réponse brute du fetch selon le mode :
 *   - focalAssetId non null → endpoint single-asset : { asset: {...} } (wrapped)
 *   - focalAssetId null     → endpoint liste        : { assets: [...] }
 *
 * Retourne toujours un tableau d'ApiAsset (vide si données absentes/malformées).
 */
export function parseAssetFetchResult(data: unknown, focalAssetId: string | null): ApiAsset[] {
  if (data == null || typeof data !== "object") return [];
  if (focalAssetId) {
    const asset = (data as { asset?: ApiAsset }).asset;
    return asset?.id ? [asset] : [];
  }
  return (data as { assets?: ApiAsset[] }).assets ?? [];
}

/** Mappe un Asset V2 vers un slot typé video/image avec statut dérivé. */
function apiToAsset(api: ApiAsset, idx: number): AssetItem {
  const ref = api.contentRef ?? "";
  const isVideo = api.kind === "video" || VIDEO_RE.test(ref);
  const isImage = IMAGE_RE.test(ref);
  const type: AssetMediaType = isVideo ? "video" : isImage ? "image" : "image";
  const hasMedia = Boolean(ref) && (isVideo || isImage);

  return {
    id: api.id,
    title: api.title,
    type,
    status: hasMedia ? "ready" : "running",
    thumbnail: hasMedia ? ref : undefined,
    tag: api.kind || `Slot ${idx}`,
  };
}

/** Étiquette FR pour l'état d'un asset. */
function statusLabel(status: AssetStatus): string {
  switch (status) {
    case "running":
      return "Rendu en cours";
    case "ready":
      return "Rendu terminé";
    case "error":
      return "Erreur";
  }
}

// ── Sub-composants ───────────────────────────────────────────────────────────

function LoadingGrid() {
  return (
    <div
      className="grid grid-cols-2"
      style={{ gap: "var(--space-4)" }}
      aria-busy="true"
      aria-live="polite"
    >
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="animate-pulse aspect-video rounded-xl border border-(--line) bg-(--surface-1)"
        />
      ))}
    </div>
  );
}

function EmptyAssetState() {
  return (
    <EmptyState
      title="Aucun asset généré"
      description="Lance une mission ou demande à l'agent de créer un asset."
      cta={{
        label: "Générer un asset",
        onClick: () =>
          useStageStore.getState().setCommandeurOpen(true, {
            prefilledQuery: "Générer un nouvel asset",
          }),
      }}
    />
  );
}

function assetStatusClass(status: AssetItem["status"]): string {
  if (status === "error") return "bg-(--danger)/18 text-(--danger)";
  if (status === "running") return "bg-(--accent-teal-surface) text-(--accent-teal)";
  return "bg-(--surface-2) text-text-soft";
}

function AssetSlot({ asset, index }: { asset: AssetItem; index: number }) {
  const isReady = asset.status === "ready";

  return (
    <div className={`slot${isReady ? " loaded" : ""}`}>
      {!isReady && <div className="breath" />}

      {asset.thumbnail && isReady ? (
        asset.type === "video" ? (
          <video
            src={asset.thumbnail}
            autoPlay
            loop
            muted
            playsInline
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              borderRadius: "inherit",
            }}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.thumbnail}
            alt={asset.title}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              borderRadius: "inherit",
            }}
          />
        )
      ) : (
        <div className={`bg v${index % 4}`} />
      )}

      {/* Badge variant haut gauche */}
      <div className="absolute top-2.5 left-2.5 z-[5] inline-block px-2 py-0.5 rounded-pill bg-(--surface-2) t-9 font-semibold tracking-wide text-text">
        {`V${index}`}
      </div>

      <div
        className={`absolute bottom-2.5 right-2.5 z-[5] px-2.5 py-1 rounded-pill t-11 font-medium ${assetStatusClass(asset.status)}`}
      >
        {statusLabel(asset.status)}
      </div>

      <div className="cap">
        <span className="tag">{asset.tag}</span>
        <div>{asset.title}</div>
      </div>
    </div>
  );
}

// ── Composant principal ──────────────────────────────────────────────────────

export function AssetStage({ mode }: { mode: string }) {
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Lit l'asset focal demandé (Cmd+K, lien chat, etc.). Si présent →
  // single-asset fetch ; sinon → gallery des 4 plus récents.
  const focalAssetId = useStageStore((s) =>
    s.current.mode === "asset" ? s.current.assetId : null,
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const url = focalAssetId
      ? `/api/v2/assets/${encodeURIComponent(focalAssetId)}`
      : "/api/v2/assets?limit=4";

    fetch(url, { credentials: "include" })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json() as Promise<Partial<ApiAssetsResponse> & Partial<ApiAsset>>;
      })
      .then((data) => {
        if (cancelled) return;
        const list = parseAssetFetchResult(data, focalAssetId);
        setAssets(list.slice(0, 4).map((a, i) => apiToAsset(a, i)));
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(sanitizeApiError(err));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [focalAssetId]);

  // Pousse les slots dans shellData → miroir ContextRail
  useEffect(() => {
    const items: RailItem[] = assets.map((a, i) => ({
      t: `${a.tag} · Slot ${i}`,
      s: statusLabel(a.status),
      hot: a.status === "running",
    }));
    useStageData.getState().setShellData("Génération en cours", items);
    return () => {
      useStageData.getState().clearShellData();
    };
  }, [assets]);

  // Dev only : si aucune donnée réelle et pas d'erreur/chargement, on injecte
  // un jeu fictif pour pouvoir développer le design. En prod : inchangé.
  const isDemo = IS_DEV && !loading && !error && assets.length === 0;
  const displayAssets = isDemo ? DEMO_ASSETS : assets;

  const readyCount = displayAssets.filter((a) => a.status === "ready").length;
  const total = displayAssets.length;

  return (
    <motion.section
      key={mode}
      variants={SECTION_VARIANTS}
      initial="hidden"
      animate="show"
      className="preserve-3d flex w-full flex-col gap-16"
    >
      {/* Badge démo dev-only */}
      {isDemo && (
        <span
          className="t-9 font-mono uppercase self-start"
          style={{
            padding: "var(--space-1) var(--space-2)",
            color: "var(--text-faint)",
            background: "var(--surface-1)",
            borderRadius: "var(--radius-xs)",
          }}
        >
          Démo · données fictives (dev)
        </span>
      )}

      {/* Header standardisé via StageLayout (eyebrow/title/subtitle cohérents). */}
      <StageLayout
        eyebrow={
          loading
            ? "Chargement"
            : error
              ? "Erreur de chargement"
              : total === 0
                ? "Aucun asset"
                : `${total} asset${total > 1 ? "s" : ""} · ${readyCount} prêt${readyCount > 1 ? "s" : ""}`
        }
        title={loading ? "Chargement des assets" : total === 0 ? "Génération média" : "Assets"}
        subtitle={STAGE_REGISTRY.asset.tagline || undefined}
      >
        {/* Tags (sous le header, conservé) */}
        {total > 0 && (
          <p className="t-13 text-text-muted" style={{ marginBottom: "var(--space-4)" }}>
            {displayAssets.map((a) => a.tag).join(" · ")}
          </p>
        )}

        {/* Error */}
        {error && <StageErrorBanner message={error} />}

        {/* Loading */}
        {loading && !error && <LoadingGrid />}

        {/* Empty */}
        {!loading && !error && total === 0 && <EmptyAssetState />}

        {/* Populated */}
        {!loading && !error && total > 0 && (
          <div className="asset-grid">
            {displayAssets.map((asset, idx) => (
              <AssetSlot key={asset.id} asset={asset} index={idx} />
            ))}
          </div>
        )}

        {/* Footer */}
        {!loading && !error && total > 0 && (
          <p className="text-center t-13 text-text-faint" style={{ marginTop: "var(--space-4)" }}>
            {readyCount === total
              ? `${total} variant${total > 1 ? "s" : ""} prêt${total > 1 ? "s" : ""}`
              : `${readyCount} prêt${readyCount > 1 ? "s" : ""} · ${total - readyCount} en cours`}
          </p>
        )}
      </StageLayout>
    </motion.section>
  );
}
