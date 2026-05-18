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
import { EmptyState } from "@/app/(user)/components/ui";
import { sanitizeApiError } from "@/app/(user)/lib/sanitize-error";
import { useStageStore } from "@/stores/stage";
import { useStageData } from "@/stores/stage-data";
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
          className="animate-pulse"
          style={{
            aspectRatio: "16 / 9",
            borderRadius: "var(--radius-xl)",
            background: "var(--surface-row-hover)",
            border: "1px solid var(--line-strong)",
          }}
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

function ErrorBanner({ error }: { error: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: VISION_EASE }}
      style={{
        padding: "var(--space-3-5) var(--space-4-5)",
        borderRadius: "var(--radius-md)",
        background: "var(--danger-surface-soft)",
        borderLeft: "2px solid var(--danger-border)",
        color: "var(--danger)",
        fontSize: "var(--text-sm)",
        lineHeight: "var(--leading-comfortable)",
      }}
    >
      <strong style={{ color: "var(--danger)", fontWeight: "var(--weight-semibold)" }}>
        Erreur
      </strong>{" "}
      — {error}
    </motion.div>
  );
}

function AssetSlot({ asset, index }: { asset: AssetItem; index: number }) {
  const isReady = asset.status === "ready";
  const isRunning = asset.status === "running";
  const isError = asset.status === "error";

  const statusBg = isError
    ? "var(--danger-surface)"
    : isRunning
      ? "var(--accent-teal-surface)"
      : "var(--surface-icon-tile)";
  const statusColor = isError
    ? "var(--danger)"
    : isRunning
      ? "var(--accent-teal)"
      : "var(--text-muted)";

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
      <div
        style={{
          position: "absolute",
          top: "var(--space-2-5)",
          left: "var(--space-2-5)",
          zIndex: "var(--z-noise)",
          display: "inline-block",
          padding: "3px 9px",
          borderRadius: "var(--radius-pill)",
          background: "var(--ghost-modal-top)",
          fontSize: "var(--text-xs)",
          fontWeight: "var(--weight-semibold)",
          letterSpacing: "var(--tracking-eyebrow-soft)",
          color: "var(--text)",
        }}
      >
        {`V${index}`}
      </div>

      {/* Pill statut bas-droite */}
      <div
        style={{
          position: "absolute",
          bottom: "var(--space-2-5)",
          right: "var(--space-2-5)",
          zIndex: "var(--z-noise)",
          padding: "var(--space-1) var(--space-2-5)",
          borderRadius: "var(--radius-pill)",
          background: statusBg,
          color: statusColor,
          fontSize: "var(--text-xs)",
          fontWeight: "var(--weight-medium)",
        }}
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

  const readyCount = assets.filter((a) => a.status === "ready").length;
  const total = assets.length;

  return (
    <motion.section
      key={mode}
      variants={SECTION_VARIANTS}
      initial="hidden"
      animate="show"
      className="preserve-3d flex w-full flex-col gap-16"
    >
      {/* Header */}
      <header style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <p
          style={{
            fontSize: "var(--text-xs)",
            letterSpacing: "var(--tracking-eyebrow-soft)",
            color: "var(--text-l2)",
          }}
        >
          {loading
            ? "Chargement"
            : error
              ? "Erreur de chargement"
              : total === 0
                ? "Aucun asset"
                : `${total} asset${total > 1 ? "s" : ""} · ${readyCount} prêt${readyCount > 1 ? "s" : ""}`}
        </p>
        <h1
          style={{
            fontSize: "var(--text-4xl)",
            fontWeight: "var(--weight-medium)",
            letterSpacing: "var(--tracking-tight)",
          }}
        >
          {loading ? "Chargement des assets" : total === 0 ? "Génération média" : "Assets"}
        </h1>
        {STAGE_REGISTRY.asset.tagline && (
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--text-faint)",
              lineHeight: "var(--leading-body-tight)",
            }}
          >
            {STAGE_REGISTRY.asset.tagline}
          </p>
        )}
        {total > 0 && (
          <p style={{ fontSize: "var(--text-base)", color: "var(--text-muted)" }}>
            {assets.map((a) => a.tag).join(" · ")}
          </p>
        )}
      </header>

      {/* Error */}
      {error && <ErrorBanner error={error} />}

      {/* Loading */}
      {loading && !error && <LoadingGrid />}

      {/* Empty */}
      {!loading && !error && total === 0 && <EmptyAssetState />}

      {/* Populated */}
      {!loading && !error && total > 0 && (
        <div className="asset-grid">
          {assets.map((asset, idx) => (
            <AssetSlot key={asset.id} asset={asset} index={idx} />
          ))}
        </div>
      )}

      {/* Footer */}
      {!loading && !error && total > 0 && (
        <p
          style={{
            textAlign: "center",
            fontSize: "var(--text-sm)",
            color: "var(--text-faint)",
          }}
        >
          {readyCount === total
            ? `${total} variant${total > 1 ? "s" : ""} prêt${total > 1 ? "s" : ""}`
            : `${readyCount} prêt${readyCount > 1 ? "s" : ""} · ${total - readyCount} en cours`}
        </p>
      )}
    </motion.section>
  );
}
