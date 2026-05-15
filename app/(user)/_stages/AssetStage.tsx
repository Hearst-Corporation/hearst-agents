"use client";

/**
 * AssetStage — consumer data-bound du run de génération média.
 *
 * Pattern pilote ChatStage : fetch `/api/v2/assets?limit=4`, expose un
 * `AssetItem` typé (video / image), pousse les slots dans `useStageData
 * .shellData` pour alimenter le ContextRail. États couverts : loading,
 * error, empty, populated. Voix FR régulière, pas de mockup fallback.
 */

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useStageData } from "@/stores/stage-data";
import type { RailItem } from "./types";

// ── Types ────────────────────────────────────────────────────────────────────

type AssetMediaType = "video" | "image";

type AssetStatus = "running" | "ready" | "error";

interface AssetItem {
  id: string;
  title: string;
  type: AssetMediaType;
  status: AssetStatus;
  thumbnail?: string;
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

const VISION_EASE = [0.22, 1, 0.36, 1] as const;

const SECTION_VARIANTS = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: VISION_EASE } },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const VIDEO_RE = /\.(mp4|webm|mov)(\?|$)/i;
const IMAGE_RE = /\.(jpg|jpeg|png|gif|webp|avif)(\?|$)/i;

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
            borderRadius: "var(--radius-xl, 18px)",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        />
      ))}
    </div>
  );
}

function EmptyAssetState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: VISION_EASE }}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "80px 0",
        textAlign: "center",
      }}
    >
      <p
        className="t-15"
        style={{
          color: "rgba(255,255,255,0.45)",
          maxWidth: "440px",
          lineHeight: 1.6,
        }}
      >
        Aucun asset généré. Lance une mission ou demande à l'agent.
      </p>
    </motion.div>
  );
}

function ErrorBanner({ error }: { error: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: VISION_EASE }}
      style={{
        padding: "14px 18px",
        borderRadius: "12px",
        background: "rgba(255,80,80,0.08)",
        borderLeft: "2px solid rgba(255,120,120,0.55)",
        color: "rgba(255,200,200,0.85)",
        fontSize: "13px",
        lineHeight: 1.55,
      }}
    >
      <strong style={{ color: "rgba(255,180,180,0.95)", fontWeight: 600 }}>Erreur</strong> — {error}
    </motion.div>
  );
}

function AssetSlot({ asset, index }: { asset: AssetItem; index: number }) {
  const isReady = asset.status === "ready";
  const isRunning = asset.status === "running";
  const isError = asset.status === "error";

  const statusBg = isError
    ? "rgba(255,80,80,0.18)"
    : isRunning
      ? "rgba(94,229,195,0.18)"
      : "rgba(255,255,255,0.10)";
  const statusColor = isError
    ? "rgba(255,140,140,0.92)"
    : isRunning
      ? "rgba(94,229,195,0.92)"
      : "rgba(255,255,255,0.78)";

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
          top: "10px",
          left: "10px",
          zIndex: 5,
          display: "inline-block",
          padding: "3px 9px",
          borderRadius: "9999px",
          background: "rgba(255,255,255,0.12)",
          fontSize: "10px",
          fontWeight: 600,
          letterSpacing: "0.04em",
          color: "white",
        }}
      >
        {`V${index}`}
      </div>

      {/* Pill statut bas-droite */}
      <div
        style={{
          position: "absolute",
          bottom: "10px",
          right: "10px",
          zIndex: 5,
          padding: "4px 10px",
          borderRadius: "9999px",
          background: statusBg,
          color: statusColor,
          fontSize: "11px",
          fontWeight: 500,
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

  // Fetch initial — `/api/v2/assets?limit=4`
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch("/api/v2/assets?limit=4", { credentials: "include" })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json() as Promise<Partial<ApiAssetsResponse>>;
      })
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data.assets) ? data.assets : [];
        setAssets(list.slice(0, 4).map((a, i) => apiToAsset(a, i)));
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Erreur inconnue";
        setError(msg);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

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
      className="preserve-3d flex w-full max-w-[760px] flex-col gap-16"
    >
      {/* Header */}
      <header style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <p
          style={{
            fontSize: "12px",
            letterSpacing: "0.04em",
            color: "rgba(255,255,255,0.35)",
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
        <h1 style={{ fontSize: "32px", fontWeight: 500, letterSpacing: "-0.02em" }}>
          {loading
            ? "Chargement des assets"
            : total === 0
              ? "Génération média"
              : "Variants en cours"}
        </h1>
        {total > 0 && (
          <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)" }}>
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
            fontSize: "13px",
            color: "rgba(255,255,255,0.4)",
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
