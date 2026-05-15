"use client";

/**
 * ReportLayout — orchestrateur du rendu d'un payload report (sortie de
 * `runReport`). Compose le header (actions + toggles), la grille 4 cols,
 * le footer méta, et les panneaux latéraux droit (éditeur ou historique).
 *
 * Branchement Focal : FocalStage détecte `previewContent` parsable JSON avec
 * `__reportPayload: true` et délègue à ce composant.
 *
 * Layout : grid 4 colonnes (1 = quart, 2 = moitié, 4 = pleine), gap via tokens.
 * Cohérence DS : sections labelisées en voix régulière FR (.t-11 medium),
 * lignes 1px sur surface-2, accent teal pour les hover et titres section.
 *
 * Édition : si `spec` + `onSpecChange` sont fournis, un bouton "Éditer" en
 * header ouvre un panneau latéral droit (`ReportEditor`) qui permet de toggler
 * la visibilité, réordonner et reset les blocks. Les blocks marqués `hidden:true`
 * sont filtrés du rendu côté UI sans toucher aux données amont.
 *
 * Invariants reports verrouillés (cf. docs/features/reports.md) :
 * la structure visuelle ci-dessous est canonique. Le pipeline engine et
 * le sharing HMAC vivent côté backend et ne sont pas touchés ici.
 */

import { type JSX, useState } from "react";
import { ReportEditor } from "@/app/(user-legacy)/components/reports/ReportEditor";
import type { RenderPayload } from "@/lib/reports/engine/render-blocks";
import type { ReportSpec } from "@/lib/reports/spec/schema";

import { RealtimeToast } from "./RealtimeToast";
import { ReportGrid } from "./ReportGrid";
import { ReportHeader } from "./ReportHeader";
import { ReportMetaFooter } from "./ReportMetaFooter";
import { useRealtimePayload } from "./use-realtime-payload";
import { useVisibleBlocks } from "./use-visible-blocks";
import { VersionHistoryPanel } from "./VersionHistoryPanel";

export interface ReportLayoutProps {
  payload: RenderPayload;
  /** Affichage optionnel d'un footer technique (timestamp, version). */
  showMeta?: boolean;
  /**
   * Spec source courant (optionnel). Si fourni avec `onSpecChange`, le bouton
   * "Éditer" du header ouvre le panneau ReportEditor et les blocks `hidden`
   * sont filtrés du rendu.
   */
  spec?: ReportSpec;
  /** Callback pour synchroniser le spec avec un parent contrôlé. */
  onSpecChange?: (spec: ReportSpec) => void;
  /**
   * Asset.id du report rendu (optionnel). Si fourni, affiche les boutons
   * "Exporter / Partager / Commenter" en header. Sinon, header vide.
   */
  assetId?: string | null;
  /** Titre suggéré pour l'export (sinon "report"). */
  assetTitle?: string;
  /**
   * Si `true`, masque les actions et passe en mode lecture seule (page publique).
   * Par défaut `false` (les actions sont visibles si assetId fourni).
   */
  readonly?: boolean;
}

export function ReportLayout({
  payload,
  showMeta = true,
  spec,
  onSpecChange,
  assetId,
  assetTitle,
  readonly = false,
}: ReportLayoutProps): JSX.Element {
  const [editorOpen, setEditorOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const editable = Boolean(spec && onSpecChange);

  const { effectivePayload, showToast } = useRealtimePayload(payload, assetId);
  const visibleBlocks = useVisibleBlocks(effectivePayload, spec);

  const showHistoryPanel = historyOpen && Boolean(assetId) && !readonly;
  const showEditorPanel = editable && editorOpen && Boolean(spec) && Boolean(onSpecChange);

  return (
    <div className="flex w-full" style={{ gap: "var(--space-4)" }} data-testid="report-layout">
      <div className="flex flex-col flex-1 min-w-0">
        {showToast && <RealtimeToast />}

        <ReportHeader
          assetId={assetId}
          assetTitle={assetTitle}
          readonly={readonly}
          editable={editable}
          editorOpen={editorOpen}
          historyOpen={historyOpen}
          onToggleEditor={() => {
            setEditorOpen((v) => !v);
            setHistoryOpen(false);
          }}
          onToggleHistory={() => {
            setHistoryOpen((v) => !v);
            setEditorOpen(false);
          }}
        />

        <ReportGrid payload={effectivePayload} visibleBlocks={visibleBlocks} />

        {showMeta && <ReportMetaFooter payload={effectivePayload} />}
      </div>

      {showEditorPanel && spec && onSpecChange && (
        <div className="flex flex-col shrink-0" style={{ width: "var(--width-context)" }}>
          <ReportEditor spec={spec} onChange={onSpecChange} onClose={() => setEditorOpen(false)} />
        </div>
      )}

      {showHistoryPanel && assetId && (
        <div className="flex flex-col shrink-0" style={{ width: "var(--width-context)" }}>
          <VersionHistoryPanel
            assetId={assetId}
            currentPayload={payload}
            onClose={() => setHistoryOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
