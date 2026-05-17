"use client";

/**
 * AssetCompareStage — Compare 2 à 4 assets côte-à-côte.
 *
 * Layout adaptatif :
 *   - 2 assets : split 50/50 horizontal
 *   - 3 assets : grid 3 colonnes
 *   - 4 assets : grid 2×2
 *
 * Chaque pane montre titre + lineage compact + body texte tronqué + provider/
 * prompt en header. Bouton "Choisir" sur chaque pane (Q3-A) pour marquer un
 * variant comme "best" (no-op MVP — flag dans metadata).
 *
 * Header global propose un bouton "Diff sémantique" — actif uniquement quand
 * exactement 2 assets sont comparés (l'API `/assets/diff` reste pairwise).
 *
 * Activé via `useStageStore.setMode({ mode: "asset_compare", assetIds: [...] })` —
 * typiquement déclenché par le Commandeur (2 assets) ou par VideoQuickLaunch
 * en mode batch (jusqu'à 4 variants).
 */

import { useEffect, useState } from "react";
import { sanitizeApiError } from "@/app/(user)/lib/sanitize-error";
import type { Asset } from "@/lib/assets/types";
import { useSelectionStore } from "@/stores/selection";
import { useStageStore } from "@/stores/stage";
import { AssetLineage } from "../AssetLineage";
import { StageActionBar } from "./StageActionBar";

interface AssetCompareStageProps {
  /** 2 à 4 assetIds — au-delà, seuls les 4 premiers sont rendus. */
  assetIds: string[];
}

interface DiffResult {
  summary: string;
  differences: Array<{ kind: string; description: string }>;
}

const MAX_PANES = 4;

export function AssetCompareStage({ assetIds }: AssetCompareStageProps) {
  const back = useStageStore((s) => s.back);
  const setMode = useStageStore((s) => s.setMode);

  // Cap dur à 4 panes pour préserver la lisibilité.
  const ids = assetIds.slice(0, MAX_PANES);
  const count = ids.length;

  const [assets, setAssets] = useState<(Asset | null)[]>(() => ids.map(() => null));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [diff, setDiff] = useState<DiffResult | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [bestIndex, setBestIndex] = useState<number | null>(null);

  const _idsKey = ids.join("|");

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset intentionnel avant fetch : nécessaire pour afficher le loading au changement d'assetIds
    setLoading(true);
    setError(null);
    setDiff(null);
    setDiffError(null);
    setBestIndex(null);

    Promise.all(
      ids.map((id) =>
        fetch(`/api/v2/assets/${encodeURIComponent(id)}`, { credentials: "include" })
          .then((r) => r.json())
          .catch(() => null),
      ),
    )
      .then((results) => {
        if (cancelled) return;
        const loaded: (Asset | null)[] = results.map((r) => (r?.asset ?? null) as Asset | null);
        const missing = loaded.filter((a) => a === null).length;
        if (missing === ids.length) {
          setError("Aucun asset trouvé");
          return;
        }
        if (missing > 0) {
          setError(
            `${missing} asset${missing > 1 ? "s" : ""} introuvable${missing > 1 ? "s" : ""}`,
          );
        }
        setAssets(loaded);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(sanitizeApiError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // idsKey capture la liste — ESLint ignore les deps ids/setters volontairement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.map, ids.length]);

  const canDiff = count === 2;

  const handleDiff = async () => {
    if (!canDiff) return;
    const [a, b] = ids;
    setDiffLoading(true);
    setDiffError(null);
    setDiff(null);
    try {
      const res = await fetch("/api/v2/assets/diff", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetIdA: a, assetIdB: b }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDiffError(data?.message ?? data?.error ?? `HTTP ${res.status}`);
        return;
      }
      setDiff(data as DiffResult);
    } catch (err) {
      setDiffError(sanitizeApiError(err));
    } finally {
      setDiffLoading(false);
    }
  };

  const openParent = (assetId: string) => {
    useSelectionStore.getState().select({ kind: "asset", id: assetId });
    setMode({ mode: "asset", assetId });
  };

  // Grille adaptative : 2 → 1×2, 3 → 1×3, 4 → 2×2.
  const gridTemplate = count === 4 ? "1fr 1fr" : count === 3 ? "1fr 1fr 1fr" : "1fr 1fr";
  const gridRows = count === 4 ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 1fr)";

  const ctxLabel = `Comparer · ${count} variant${count > 1 ? "s" : ""}`;

  return (
    <div className="flex-1 flex flex-col min-h-0" style={{ background: "var(--surface)" }}>
      <StageActionBar
        onBack={back}
        context={<span className="t-11 font-light text-text-muted">{ctxLabel}</span>}
        primary={
          canDiff
            ? {
                id: "diff",
                label: "Diff sémantique",
                onClick: () => void handleDiff(),
                disabled: loading || assets.some((a) => a === null),
                loading: diffLoading,
              }
            : undefined
        }
      />

      {error && (
        <div
          style={{
            padding: "var(--space-4)",
            borderLeft: "2px solid var(--danger)",
            background: "var(--surface-1)",
            margin: "var(--space-4) var(--space-6)",
          }}
        >
          <p className="t-11 font-medium text-(--danger)">{error}</p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center" style={{ padding: "var(--space-12)" }}>
          <span className="t-11 font-light text-text-faint">Chargement…</span>
        </div>
      )}

      {!loading && (
        <div className="flex-1 overflow-y-auto" style={{ padding: "var(--space-6)" }}>
          <div
            className="grid"
            style={{
              gridTemplateColumns: gridTemplate,
              gridTemplateRows: gridRows,
              gap: "var(--space-6)",
              marginBottom: "var(--space-8)",
            }}
            data-testid="asset-compare-grid"
            data-pane-count={count}
          >
            {ids.map((id, i) => {
              const asset = assets[i];
              return (
                <ComparePane
                  key={id}
                  index={i}
                  assetId={id}
                  asset={asset}
                  isBest={bestIndex === i}
                  onChooseBest={() => setBestIndex((prev) => (prev === i ? null : i))}
                  onOpenParent={openParent}
                />
              );
            })}
          </div>

          {diffError && (
            <div
              style={{
                padding: "var(--space-4)",
                borderLeft: "2px solid var(--danger)",
                background: "var(--surface-1)",
                marginBottom: "var(--space-6)",
              }}
            >
              <p className="t-11 font-medium text-(--danger)">{diffError}</p>
            </div>
          )}

          {diff && (
            <div
              data-testid="asset-compare-diff"
              className="flex flex-col"
              style={{
                padding: "var(--space-5) var(--space-6)",
                background: "var(--surface-1)",
                border: "1px solid var(--accent-teal)",
                borderRadius: "var(--radius-md)",
                gap: "var(--space-4)",
              }}
            >
              <header className="flex items-center" style={{ gap: "var(--space-3)" }}>
                <span className="t-13 font-medium text-(--accent-teal)">
                  Différences · {diff.differences.length}
                </span>
              </header>
              <p className="t-13 font-light text-text leading-relaxed">{diff.summary}</p>
              <ul
                className="flex flex-col"
                style={{ gap: "var(--space-2)", listStyle: "none", paddingLeft: 0 }}
              >
                {diff.differences.map((d, i) => (
                  <li
                    key={i}
                    className="flex"
                    style={{
                      gap: "var(--space-3)",
                      padding: "var(--space-2) var(--space-3)",
                      background: "var(--bg-elev)",
                      border: "1px solid var(--surface-2)",
                      borderRadius: "var(--radius-xs)",
                    }}
                  >
                    <span className="t-11 font-medium text-(--accent-teal) shrink-0">{d.kind}</span>
                    <span className="t-11 font-light text-text-soft">{d.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ComparePane({
  index,
  assetId,
  asset,
  isBest,
  onChooseBest,
  onOpenParent,
}: {
  index: number;
  assetId: string;
  asset: Asset | null;
  isBest: boolean;
  onChooseBest: () => void;
  onOpenParent: (assetId: string) => void;
}) {
  const labelLetter = String.fromCharCode(65 + index); // A, B, C, D
  const meta = asset?.provenance?.metadata as
    | { prompt?: string; ratio?: string; duration?: number }
    | undefined;
  const provider = asset?.provenance?.providerId;
  const promptOriginal = typeof meta?.prompt === "string" ? meta.prompt : undefined;

  return (
    <div
      data-testid={`asset-compare-pane-${labelLetter}`}
      data-pane-index={index}
      className="flex flex-col"
      style={{
        padding: "var(--space-5)",
        background: "var(--surface-1)",
        border: isBest ? "1px solid var(--accent-teal)" : "1px solid var(--border-shell)",
        borderRadius: "var(--radius-md)",
        gap: "var(--space-3)",
        minWidth: 0,
      }}
    >
      <header className="flex items-center justify-between" style={{ gap: "var(--space-2)" }}>
        <span className="t-11 font-medium text-(--accent-teal)">Variant {labelLetter}</span>
        {provider && (
          <span className="t-11 font-light text-text-muted truncate" style={{ maxWidth: "60%" }}>
            {provider}
            {typeof meta?.ratio === "string" ? ` · ${meta.ratio}` : ""}
            {typeof meta?.duration === "number" ? ` · ${meta.duration}s` : ""}
          </span>
        )}
      </header>

      {asset === null ? (
        <span className="t-11 font-light text-text-faint">
          Asset {assetId.slice(0, 8)} introuvable
        </span>
      ) : (
        <>
          <h2
            className="t-15 font-medium tracking-tight text-text"
            style={{ marginBottom: "var(--space-1)" }}
          >
            {asset.title}
          </h2>
          {promptOriginal && (
            <p
              className="t-11 font-light text-text-muted leading-relaxed"
              style={{ marginBottom: "var(--space-2)" }}
            >
              {promptOriginal.length > 180 ? `${promptOriginal.slice(0, 180)}…` : promptOriginal}
            </p>
          )}
          <AssetLineage asset={asset} onOpenParent={onOpenParent} />
          <div
            className="overflow-y-auto"
            style={{
              maxHeight: "var(--space-32)",
              padding: "var(--space-3)",
              background: "var(--bg-elev)",
              border: "1px solid var(--surface-2)",
              borderRadius: "var(--radius-xs)",
            }}
          >
            <pre className="t-11 font-mono text-text-muted" style={{ whiteSpace: "pre-wrap" }}>
              {(asset.contentRef ?? asset.summary ?? "Aucun contenu").slice(0, 4000)}
            </pre>
          </div>
          <button
            type="button"
            onClick={onChooseBest}
            className={`t-11 font-light transition-colors duration-base ${
              isBest
                ? "border border-(--accent-teal) text-(--accent-teal) bg-[var(--accent-teal-surface)]"
                : "border border-(--border-shell) text-text-muted hover:text-text"
            }`}
            style={{
              padding: "var(--space-2) var(--space-3)",
              borderRadius: "var(--radius-sm)",
              alignSelf: "flex-start",
            }}
            aria-pressed={isBest}
          >
            {isBest ? "Variant choisi" : "Choisir ce variant"}
          </button>
        </>
      )}
    </div>
  );
}
