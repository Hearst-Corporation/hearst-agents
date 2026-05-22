/**
 * VersionHistoryPanel — panneau latéral d'historique des versions d'un report.
 *
 * Charge les versions append-only via `/api/reports/[id]/versions`, permet la
 * sélection de deux versions (A/B) pour comparer (`/diff`) et propose la
 * restauration d'une version (POST `/versions/[n]` → crée une nouvelle
 * version contenant le snapshot ciblé — append-only respecté côté API).
 *
 * Aucune logique HMAC / sharing ici : c'est un panneau de visualisation
 * adossé aux endpoints existants.
 */

import { type JSX, useCallback, useEffect, useState } from "react";
import { Action, IconButton } from "@/app/(user)/components/ui";
import type { RenderPayload } from "@/lib/reports/engine/render-blocks";
import type { VersionDiff } from "@/lib/reports/versions/diff";
import type { VersionSummary } from "@/lib/reports/versions/store";
import { fmtIso, kindLabel } from "./utils";

const VERSIONS_LIST_LIMIT = 50;

interface VersionHistoryPanelProps {
  assetId: string;
  currentPayload: RenderPayload;
  onClose: () => void;
}

export function VersionHistoryPanel({ assetId, onClose }: VersionHistoryPanelProps): JSX.Element {
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [compareA, setCompareA] = useState<number | null>(null);
  const [compareB, setCompareB] = useState<number | null>(null);
  const [diffs, setDiffs] = useState<VersionDiff[] | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [restoring, setRestoring] = useState<number | null>(null);
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null);

  const loadVersions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/${assetId}/versions?limit=${VERSIONS_LIST_LIMIT}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { versions: VersionSummary[] };
      setVersions(json.versions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur réseau");
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    const run = async () => {
      await loadVersions();
    };
    run().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadVersions]);

  const handleCompare = useCallback(async () => {
    if (compareA === null || compareB === null) return;
    const from = Math.min(compareA, compareB);
    const to = Math.max(compareA, compareB);
    setDiffLoading(true);
    setDiffs(null);
    try {
      const res = await fetch(`/api/reports/${assetId}/versions/diff?from=${from}&to=${to}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { diffs: VersionDiff[] };
      setDiffs(json.diffs ?? []);
    } catch (e) {
      setDiffs([]);
      console.error("[VersionHistoryPanel] diff error:", e);
    } finally {
      setDiffLoading(false);
    }
  }, [assetId, compareA, compareB]);

  const handleRestore = useCallback(
    async (vn: number) => {
      setRestoring(vn);
      setRestoreMsg(null);
      try {
        const res = await fetch(`/api/reports/${assetId}/versions/${vn}`, {
          method: "POST",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { version: VersionSummary };
        setRestoreMsg(`Version ${vn} restaurée → nouvelle v${json.version.versionNumber}`);
        void loadVersions();
      } catch (e) {
        setRestoreMsg(`Erreur : ${e instanceof Error ? e.message : "inconnue"}`);
      } finally {
        setRestoring(null);
      }
    },
    [assetId, loadVersions],
  );

  return (
    <div
      className="flex flex-col"
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-4)",
        gap: "var(--space-3)",
        height: "100%",
        overflowY: "auto",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between" style={{ gap: "var(--space-2)" }}>
        <span className="t-13 font-medium text-text-muted">Historique</span>
        <IconButton icon="✕" label="Fermer l'historique" size="xs" tone="muted" onClick={onClose} />
      </div>

      {/* États */}
      {loading && <span className="t-11 font-light text-text-faint">Chargement…</span>}
      {error && <span className="t-11 font-light text-(--danger)">{error}</span>}
      {!loading && !error && versions.length === 0 && (
        <span className="t-11 font-light text-text-faint">Aucune version enregistrée.</span>
      )}

      {/* Feedback restauration */}
      {restoreMsg && (
        <div
          className="t-11 font-light text-(--accent-teal)"
          style={{
            padding: "var(--space-2) var(--space-3)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-xs)",
          }}
        >
          {restoreMsg}
        </div>
      )}

      {/* Liste des versions */}
      {!loading && versions.length > 0 && (
        <div className="flex flex-col" style={{ gap: "var(--space-2)" }}>
          {versions.map((v) => (
            <VersionRow
              key={v.id}
              version={v}
              compareA={compareA}
              compareB={compareB}
              restoring={restoring}
              onSelectCompare={() => {
                if (compareA === null) {
                  setCompareA(v.versionNumber);
                } else if (compareB === null && v.versionNumber !== compareA) {
                  setCompareB(v.versionNumber);
                } else {
                  setCompareA(v.versionNumber);
                  setCompareB(null);
                  setDiffs(null);
                }
              }}
              onRestore={() => void handleRestore(v.versionNumber)}
            />
          ))}
        </div>
      )}

      {/* Comparer deux versions */}
      {compareA !== null && compareB !== null && (
        <CompareSection
          compareA={compareA}
          compareB={compareB}
          diffs={diffs}
          diffLoading={diffLoading}
          onCompare={() => void handleCompare()}
        />
      )}
    </div>
  );
}

interface VersionRowProps {
  version: VersionSummary;
  compareA: number | null;
  compareB: number | null;
  restoring: number | null;
  onSelectCompare: () => void;
  onRestore: () => void;
}

function VersionRow({
  version: v,
  compareA,
  compareB,
  restoring,
  onSelectCompare,
  onRestore,
}: VersionRowProps): JSX.Element {
  const isRestoring = restoring === v.versionNumber;
  const compareLabel =
    compareA === v.versionNumber ? "A" : compareB === v.versionNumber ? "B" : "Comparer";

  return (
    <div
      className="flex flex-col"
      style={{
        padding: "var(--space-3)",
        background: "var(--card-flat-bg)",
        border: "1px solid var(--card-flat-border)",
        borderRadius: "var(--radius-xs)",
        gap: "var(--space-2)",
      }}
    >
      <div className="flex items-center justify-between">
        <span className="t-11 font-mono tabular-nums text-text">v{v.versionNumber}</span>
        <span className="t-11 font-light text-text-faint">{v.triggeredBy}</span>
      </div>
      <span className="t-11 font-light text-text-muted">{fmtIso(v.createdAt)}</span>
      <span className="t-11 font-light text-text-faint">
        {v.signalsCount} signal{v.signalsCount !== 1 ? "s" : ""}
      </span>
      <div className="flex items-center" style={{ gap: "var(--space-2)" }}>
        <Action
          variant="secondary"
          tone={compareA === v.versionNumber || compareB === v.versionNumber ? "brand" : "neutral"}
          size="sm"
          onClick={onSelectCompare}
        >
          {compareLabel}
        </Action>
        <Action
          variant="ghost"
          tone="neutral"
          size="sm"
          onClick={onRestore}
          disabled={isRestoring}
          loading={isRestoring}
        >
          Restaurer
        </Action>
      </div>
    </div>
  );
}

interface CompareSectionProps {
  compareA: number;
  compareB: number;
  diffs: VersionDiff[] | null;
  diffLoading: boolean;
  onCompare: () => void;
}

function CompareSection({
  compareA,
  compareB,
  diffs,
  diffLoading,
  onCompare,
}: CompareSectionProps): JSX.Element {
  return (
    <div className="flex flex-col" style={{ gap: "var(--space-2)" }}>
      <Action
        variant="secondary"
        tone="neutral"
        size="sm"
        onClick={onCompare}
        disabled={diffLoading}
        loading={diffLoading}
      >
        {diffLoading
          ? "Comparaison…"
          : `Comparer v${Math.min(compareA, compareB)} → v${Math.max(compareA, compareB)}`}
      </Action>

      {diffs !== null && (
        <div className="flex flex-col" style={{ gap: "var(--space-1)" }}>
          {diffs.length === 0 ? (
            <span className="t-11 font-light text-text-faint">Aucune différence détectée.</span>
          ) : (
            diffs.map((d, i) => <DiffRow key={i} diff={d} />)
          )}
        </div>
      )}
    </div>
  );
}

function DiffRow({ diff: d }: { diff: VersionDiff }): JSX.Element {
  const kindColor =
    d.kind === "added"
      ? "var(--accent-teal)"
      : d.kind === "removed"
        ? "var(--danger)"
        : "var(--text-muted)";

  return (
    <div
      className="flex flex-col"
      style={{
        padding: "var(--space-2) var(--space-3)",
        background: "var(--card-flat-bg)",
        border: "1px solid var(--card-flat-border)",
        borderRadius: "var(--radius-xs)",
        gap: "var(--space-1)",
      }}
    >
      <div className="flex items-center" style={{ gap: "var(--space-2)" }}>
        <span className="t-11 font-mono tabular-nums text-text">{d.blockRef}</span>
        <span className="t-11 font-medium" style={{ color: kindColor }}>
          {kindLabel(d.kind)}
        </span>
      </div>
      {d.fieldPath && (
        <span className="t-9 font-mono text-text-faint">
          {d.fieldPath}: {String(d.before)} → {String(d.after)}
        </span>
      )}
    </div>
  );
}
