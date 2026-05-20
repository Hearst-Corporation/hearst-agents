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
import { VISION_EASE } from "./types";

// ── Variants ──────────────────────────────────────────────────────────────────

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
        className="w-full rounded-(--radius-card) max-h-[var(--height-compare-thumb-max)] object-cover bg-(--surface)"
      />
    );
  }

  if (isImage && ref.startsWith("http")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={ref}
        alt={asset.title}
        className="w-full rounded-(--radius-card) max-h-[var(--height-compare-thumb-max)] object-cover bg-(--surface)"
      />
    );
  }

  return (
    <div className="w-full h-[var(--height-compare-thumb)] rounded-(--radius-card) bg-(--surface) border border-(--line-strong) flex items-center justify-center">
      <span className="t-11 text-(--text-decor-25)">{asset.kind}</span>
    </div>
  );
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 px-2.5 py-1.5 bg-(--surface-2) border border-(--line-strong) rounded-lg min-w-0 flex-[1_1_auto]">
      <span className="t-10 text-(--text-decor-25) font-medium">{label}</span>
      <span className="truncate t-13 text-(--text-muted)" title={value}>
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
    <div className="flex-[0_0_calc(50%-var(--space-2))] min-w-0 flex flex-col gap-3 p-5 bg-(--surface-2) border border-(--line-strong) rounded-2xl">
      <header className="flex items-center justify-between gap-2">
        <span className="t-11 font-semibold text-(--text-faint)">{label}</span>
        {asset && (
          <span className="t-10 text-(--text-decor-25)">{formatCreatedAt(asset.createdAt)}</span>
        )}
      </header>

      {isError || asset === null ? (
        <p className="t-13 text-(--danger)/70">Asset introuvable</p>
      ) : (
        <>
          <h3 className="truncate t-14 font-semibold text-(--text-soft)" title={asset.title}>
            {asset.title}
          </h3>

          <AssetPreview asset={asset} />

          {asset.summary && (
            <p className="t-13 text-(--text-ghost) leading-[var(--leading-snug-body)] line-clamp-3">
              {asset.summary}
            </p>
          )}

          <div className="flex flex-wrap gap-1.5">
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
      className="relative w-full h-[var(--height-compare-viewer)] rounded-xl overflow-hidden bg-(--bg) border border-(--line-strong) cursor-col-resize select-none"
      onMouseDown={(e) => {
        dragging.current = true;
        updateFromEvent(e.clientX);
      }}
    >
      {/* Couche gauche (A) — plein */}
      <div className="absolute inset-0 flex items-center justify-center">
        {hasImages ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewA}
            alt={assetA?.title ?? "Gauche"}
            className="w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <span className="t-13 text-(--text-decor-25)">{assetA?.title ?? "Gauche"}</span>
        )}
      </div>

      {/* Couche droite (B) — clippée à droite du slider */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          clipPath: `inset(0 0 0 ${sliderX}%)`,
          background: hasImages ? "transparent" : "var(--surface-1)",
        }}
      >
        {hasImages ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewB}
            alt={assetB?.title ?? "Droite"}
            className="w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <span className="t-13 text-(--text-decor-25)">{assetB?.title ?? "Droite"}</span>
        )}
      </div>

      {/* Ligne diviseur */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-(--text-soft)/55 -translate-x-1/2 pointer-events-none"
        style={{ left: `${sliderX}%` }}
      />

      {/* Poignée centrale */}
      <div
        className="absolute top-1/2 w-7 h-7 rounded-full bg-(--surface-2) border-2 border-(--border-shell) text-text flex items-center justify-center pointer-events-none shadow-[var(--shadow-stage-card)] -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${sliderX}%` }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path
            d="M3 6H1M9 6H11M3 6L1.5 4.5M3 6L1.5 7.5M9 6L10.5 4.5M9 6L10.5 7.5"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Labels latéraux */}
      <div className="absolute bottom-2 left-[var(--space-2-5)] t-10 font-semibold text-(--text-muted) bg-[var(--overlay-scrim)] px-2 py-0.5 rounded-[var(--radius-xs)] pointer-events-none">
        Gauche
      </div>
      <div className="absolute bottom-2 right-[var(--space-2-5)] t-10 font-semibold text-(--text-muted) bg-[var(--overlay-scrim)] px-2 py-0.5 rounded-[var(--radius-xs)] pointer-events-none">
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
        className="flex flex-col items-center justify-center py-20 text-center w-full"
      >
        <p className="t-15 text-(--text-faint) max-w-[var(--width-empty-hint)] leading-relaxed">
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
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="t-20 font-semibold text-(--text-soft)">Comparer</h2>
          <p className="t-13 text-(--text-ghost)">
            2 assets — {viewMode === "split" ? "vue divisée" : "vue superposée"}
          </p>
        </div>
      </div>

      {/* Zone principale */}
      {isLoading ? (
        <div className="flex gap-4">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="animate-pulse flex-[0_0_calc(50%-var(--space-2))] h-[var(--height-compare-viewer)] bg-(--surface-2) rounded-2xl"
            />
          ))}
        </div>
      ) : viewMode === "split" ? (
        <div className="flex gap-4 items-stretch">
          <AssetPane asset={assetA} label="Gauche" isError={errorA} />
          <AssetPane asset={assetB} label="Droite" isError={errorB} />
        </div>
      ) : (
        <OverlaySlider assetA={assetA} assetB={assetB} />
      )}

      {/* Footer toggle Split / Overlay */}
      <footer className="flex items-center justify-center gap-2 pt-1">
        {(["split", "overlay"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setViewMode(v)}
            aria-pressed={viewMode === v}
            className={[
              "px-4 py-1.5 rounded-full border t-13 font-medium cursor-pointer transition-all duration-200 focus-visible:ring-1 focus-visible:ring-(--accent-teal)/50",
              viewMode === v
                ? "border-(--accent-teal)/30 bg-(--accent-teal)/8 text-(--accent-teal)/85"
                : "border-(--line) bg-transparent text-(--text-ghost)",
            ].join(" ")}
          >
            {v === "split" ? "Vue divisée" : "Vue superposée"}
          </button>
        ))}
      </footer>
    </motion.section>
  );
}
