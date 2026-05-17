"use client";

/**
 * AssetCompareStage — consumer data-bound, pattern pilote ChatStage.
 *
 * Lit `assetIds` depuis useStageStore (mode "asset_compare", max 2).
 * Fetch chaque asset via /api/v2/assets/[id].
 * Deux modes de visualisation : Split (50/50 côte à côte) et Overlay (slider clip-path).
 * Push rail items vers useStageData.setShellData pour le ContextRail.
 */

import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Asset } from "@/lib/assets/types";
import { useStageStore } from "@/stores/stage";
import { useStageData } from "@/stores/stage-data";
import type { RailItem } from "./types";

// ── Variants ──────────────────────────────────────────────────────────────────

const VISION_EASE = [0.22, 1, 0.36, 1] as const;

const SECTION_VARIANTS = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: VISION_EASE } },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

type ViewMode = "split" | "overlay";

interface AssetMeta {
  resolution?: string | undefined;
  duration?: string | undefined;
  size?: string | undefined;
  model?: string | undefined;
}

function extractMeta(asset: Asset | null): AssetMeta {
  if (!asset) return {};
  const prov = asset.provenance;
  const raw = prov?.metadata as Record<string, unknown> | undefined;

  const resolution =
    typeof raw?.resolution === "string"
      ? raw.resolution
      : typeof raw?.ratio === "string"
        ? raw.ratio
        : undefined;

  const duration =
    typeof raw?.duration === "number"
      ? `${raw.duration}s`
      : typeof raw?.duration === "string"
        ? raw.duration
        : undefined;

  const sizeBytes = prov?.pdfFile?.sizeBytes;
  const size =
    typeof sizeBytes === "number"
      ? sizeBytes > 1_048_576
        ? `${(sizeBytes / 1_048_576).toFixed(1)} Mo`
        : `${Math.round(sizeBytes / 1024)} Ko`
      : undefined;

  const model =
    typeof prov?.modelUsed === "string"
      ? prov.modelUsed
      : typeof raw?.model === "string"
        ? raw.model
        : undefined;

  return { resolution, duration, size, model };
}

function formatCreatedAt(ts: number): string {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(ts));
  } catch {
    return String(ts);
  }
}

// ── Sub-composants ────────────────────────────────────────────────────────────

function AssetPreview({ asset }: { asset: Asset }) {
  const ref = asset.contentRef ?? "";
  const isVideo = ref.match(/\.(mp4|webm|mov)(\?|$)/i) !== null;
  const isImage = ref.match(/\.(png|jpe?g|gif|webp|avif|svg)(\?|$)/i) !== null;

  if (isVideo && ref.startsWith("http")) {
    return (
      <video
        src={ref}
        controls
        muted
        playsInline
        style={{
          width: "100%",
          borderRadius: "10px",
          maxHeight: "200px",
          objectFit: "cover",
          background: "rgba(0,0,0,0.4)",
        }}
      />
    );
  }

  if (isImage && ref.startsWith("http")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={ref}
        alt={asset.title}
        style={{
          width: "100%",
          borderRadius: "10px",
          maxHeight: "200px",
          objectFit: "cover",
          background: "rgba(0,0,0,0.4)",
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: "100%",
        height: "140px",
        borderRadius: "10px",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)" }}>{asset.kind}</span>
    </div>
  );
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "2px",
        padding: "6px 10px",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: "8px",
        minWidth: 0,
        flex: "1 1 auto",
      }}
    >
      <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", fontWeight: 500 }}>
        {label}
      </span>
      <span
        className="truncate"
        style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)" }}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

function AssetPane({
  asset,
  label,
  isError,
}: {
  asset: Asset | null;
  label: string;
  isError: boolean;
}) {
  const meta = extractMeta(asset);

  return (
    <div
      style={{
        flex: "0 0 calc(50% - 8px)",
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        padding: "18px",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "16px",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
        }}
      >
        <span style={{ fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.5)" }}>
          {label}
        </span>
        {asset && (
          <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)" }}>
            {formatCreatedAt(asset.createdAt)}
          </span>
        )}
      </header>

      {isError || asset === null ? (
        <p style={{ fontSize: "12px", color: "rgba(255,100,100,0.7)" }}>Asset introuvable</p>
      ) : (
        <>
          <h3
            className="truncate"
            style={{ fontSize: "14px", fontWeight: 600, color: "rgba(255,255,255,0.88)" }}
            title={asset.title}
          >
            {asset.title}
          </h3>

          <AssetPreview asset={asset} />

          {asset.summary && (
            <p
              style={{
                fontSize: "12px",
                color: "rgba(255,255,255,0.38)",
                lineHeight: 1.55,
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {asset.summary}
            </p>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {meta.model && <MetaChip label="Modèle" value={meta.model} />}
            {meta.resolution && <MetaChip label="Résolution" value={meta.resolution} />}
            {meta.duration && <MetaChip label="Durée" value={meta.duration} />}
            {meta.size && <MetaChip label="Taille" value={meta.size} />}
            <MetaChip label="Type" value={asset.kind} />
          </div>
        </>
      )}
    </div>
  );
}

// ── Overlay Slider ────────────────────────────────────────────────────────────

function OverlaySlider({ assetA, assetB }: { assetA: Asset | null; assetB: Asset | null }) {
  const [sliderX, setSliderX] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const updateFromEvent = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    setSliderX(pct);
  }, []);

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging.current) return;
      updateFromEvent(e.clientX);
    },
    [updateFromEvent],
  );

  const onMouseUp = useCallback(() => {
    dragging.current = false;
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  const previewA = assetA?.contentRef ?? "";
  const previewB = assetB?.contentRef ?? "";
  const isImageA =
    previewA.match(/\.(png|jpe?g|gif|webp|avif|svg)(\?|$)/i) !== null &&
    previewA.startsWith("http");
  const isImageB =
    previewB.match(/\.(png|jpe?g|gif|webp|avif|svg)(\?|$)/i) !== null &&
    previewB.startsWith("http");
  const hasImages = isImageA && isImageB;

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: "320px",
        borderRadius: "14px",
        overflow: "hidden",
        background: "rgba(0,0,0,0.3)",
        border: "1px solid rgba(255,255,255,0.08)",
        cursor: "col-resize",
        userSelect: "none",
      }}
      onMouseDown={(e) => {
        dragging.current = true;
        updateFromEvent(e.clientX);
      }}
    >
      {/* Couche gauche (A) — plein */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {hasImages ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewA}
            alt={assetA?.title ?? "Gauche"}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            draggable={false}
          />
        ) : (
          <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.25)" }}>
            {assetA?.title ?? "Gauche"}
          </span>
        )}
      </div>

      {/* Couche droite (B) — clippée à droite du slider */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          clipPath: `inset(0 0 0 ${sliderX}%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: hasImages ? "transparent" : "rgba(255,255,255,0.03)",
        }}
      >
        {hasImages ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewB}
            alt={assetB?.title ?? "Droite"}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            draggable={false}
          />
        ) : (
          <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.25)" }}>
            {assetB?.title ?? "Droite"}
          </span>
        )}
      </div>

      {/* Ligne diviseur */}
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: `${sliderX}%`,
          width: "2px",
          background: "rgba(255,255,255,0.55)",
          transform: "translateX(-50%)",
          pointerEvents: "none",
        }}
      />

      {/* Poignée centrale */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: `${sliderX}%`,
          transform: "translate(-50%, -50%)",
          width: "28px",
          height: "28px",
          borderRadius: "50%",
          background: "rgba(255,255,255,0.9)",
          border: "2px solid rgba(255,255,255,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path
            d="M3 6H1M9 6H11M3 6L1.5 4.5M3 6L1.5 7.5M9 6L10.5 4.5M9 6L10.5 7.5"
            stroke="black"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Labels latéraux */}
      <div
        style={{
          position: "absolute",
          bottom: "8px",
          left: "10px",
          fontSize: "10px",
          fontWeight: 600,
          color: "rgba(255,255,255,0.7)",
          background: "rgba(0,0,0,0.5)",
          padding: "2px 8px",
          borderRadius: "6px",
          pointerEvents: "none",
        }}
      >
        Gauche
      </div>
      <div
        style={{
          position: "absolute",
          bottom: "8px",
          right: "10px",
          fontSize: "10px",
          fontWeight: 600,
          color: "rgba(255,255,255,0.7)",
          background: "rgba(0,0,0,0.5)",
          padding: "2px 8px",
          borderRadius: "6px",
          pointerEvents: "none",
        }}
      >
        Droite
      </div>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

export function AssetCompareStage({ mode = "asset-compare" }: { mode?: string }) {
  // Lecture assetIds depuis useStageStore — useMemo évite la boucle infinie
  // (slice(0,2) et [] créent de nouvelles références à chaque render).
  const stageCurrent = useStageStore((s) => s.current);
  const assetIds = useMemo(() => {
    if (stageCurrent.mode === "asset_compare" && Array.isArray(stageCurrent.assetIds)) {
      return (stageCurrent.assetIds as string[]).slice(0, 2);
    }
    return [] as string[];
  }, [stageCurrent]);

  const [assets, setAssets] = useState<[Asset | null, Asset | null]>([null, null]);
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);
  const [errorA, setErrorA] = useState(false);
  const [errorB, setErrorB] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("split");

  const idA = assetIds[0] ?? null;
  const idB = assetIds[1] ?? null;

  // Fetch asset A
  useEffect(() => {
    if (!idA) {
      setAssets(([, b]) => [null, b]);
      setErrorA(false);
      return;
    }
    let cancelled = false;
    setLoadingA(true);
    setErrorA(false);
    fetch(`/api/v2/assets/${encodeURIComponent(idA)}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data: { asset?: Asset | null }) => {
        if (cancelled) return;
        const a = data?.asset ?? null;
        if (!a) setErrorA(true);
        setAssets(([, b]) => [a, b]);
      })
      .catch(() => {
        if (!cancelled) setErrorA(true);
      })
      .finally(() => {
        if (!cancelled) setLoadingA(false);
      });
    return () => {
      cancelled = true;
    };
  }, [idA]);

  // Fetch asset B
  useEffect(() => {
    if (!idB) {
      setAssets(([a]) => [a, null]);
      setErrorB(false);
      return;
    }
    let cancelled = false;
    setLoadingB(true);
    setErrorB(false);
    fetch(`/api/v2/assets/${encodeURIComponent(idB)}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data: { asset?: Asset | null }) => {
        if (cancelled) return;
        const b = data?.asset ?? null;
        if (!b) setErrorB(true);
        setAssets(([a]) => [a, b]);
      })
      .catch(() => {
        if (!cancelled) setErrorB(true);
      })
      .finally(() => {
        if (!cancelled) setLoadingB(false);
      });
    return () => {
      cancelled = true;
    };
  }, [idB]);

  const [assetA, assetB] = assets;

  // Push rail items → ContextRail
  useEffect(() => {
    const metaA = extractMeta(assetA);
    const metaB = extractMeta(assetB);

    const items: RailItem[] = [
      {
        t: assetA?.title ?? (idA ? `Asset ${idA.slice(0, 8)}` : "Gauche"),
        s: assetA ? assetA.kind : "—",
      },
      {
        t: assetB?.title ?? (idB ? `Asset ${idB.slice(0, 8)}` : "Droite"),
        s: assetB ? assetB.kind : "—",
      },
      {
        t: "Mode",
        s: viewMode === "split" ? "Vue divisée" : "Vue superposée",
      },
    ];

    if (assetA && assetB) {
      const diffPairs: Array<[string, string | undefined, string | undefined]> = [
        ["Modèle", metaA.model, metaB.model],
        ["Résolution", metaA.resolution, metaB.resolution],
        ["Durée", metaA.duration, metaB.duration],
        ["Taille", metaA.size, metaB.size],
      ];
      for (const [label, vA, vB] of diffPairs) {
        if (vA || vB) {
          items.push({ t: label, s: [vA, vB].filter(Boolean).join(" / ") });
        }
      }
    }

    useStageData.getState().setShellData("Métriques", items);
    return () => {
      useStageData.getState().clearShellData();
    };
  }, [assetA, assetB, idA, idB, viewMode]);

  // Empty state
  if (assetIds.length < 2) {
    return (
      <motion.section
        key={mode}
        variants={SECTION_VARIANTS}
        initial="hidden"
        animate="show"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "80px 0",
          textAlign: "center",
          width: "100%",
        }}
      >
        <p
          className="t-15"
          style={{ color: "rgba(255,255,255,0.4)", maxWidth: "400px", lineHeight: 1.6 }}
        >
          Sélectionne 2 assets depuis la liste pour les comparer.
        </p>
      </motion.section>
    );
  }

  const isLoading = loadingA || loadingB;

  return (
    <motion.section
      key={mode}
      variants={SECTION_VARIANTS}
      initial="hidden"
      animate="show"
      className="preserve-3d flex w-full flex-col gap-8"
    >
      {/* En-tête */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: "16px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <h2 style={{ fontSize: "22px", fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>
            Comparer
          </h2>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.38)" }}>
            2 assets — {viewMode === "split" ? "vue divisée" : "vue superposée"}
          </p>
        </div>
      </div>

      {/* Zone principale */}
      {isLoading ? (
        <div style={{ display: "flex", gap: "16px" }}>
          {[0, 1].map((i) => (
            <div
              key={i}
              className="animate-pulse"
              style={{
                flex: "0 0 calc(50% - 8px)",
                height: "320px",
                background: "rgba(255,255,255,0.04)",
                borderRadius: "16px",
              }}
            />
          ))}
        </div>
      ) : viewMode === "split" ? (
        <div style={{ display: "flex", gap: "16px", alignItems: "stretch" }}>
          <AssetPane asset={assetA} label="Gauche" isError={errorA} />
          <AssetPane asset={assetB} label="Droite" isError={errorB} />
        </div>
      ) : (
        <OverlaySlider assetA={assetA} assetB={assetB} />
      )}

      {/* Footer toggle Split / Overlay */}
      <footer
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          paddingTop: "4px",
        }}
      >
        {(["split", "overlay"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setViewMode(v)}
            aria-pressed={viewMode === v}
            style={{
              padding: "5px 16px",
              borderRadius: "20px",
              border:
                viewMode === v
                  ? "1px solid rgba(255,255,255,0.28)"
                  : "1px solid rgba(255,255,255,0.1)",
              background: viewMode === v ? "rgba(255,255,255,0.08)" : "transparent",
              color: viewMode === v ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.35)",
              fontSize: "12px",
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            {v === "split" ? "Vue divisée" : "Vue superposée"}
          </button>
        ))}
      </footer>
    </motion.section>
  );
}
