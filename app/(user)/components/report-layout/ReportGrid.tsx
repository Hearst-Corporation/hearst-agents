/**
 * ReportGrid — grille canonique 4 colonnes des blocks d'un report.
 *
 * Wrap dans `<SourceCitation />` pour gérer les `<sup data-source-id>` rendus
 * par les blocks (ex. KpiTile.captionHtml). Chaque block occupe `block.layout.col`
 * colonnes (1 = quart, 2 = moitié, 4 = pleine).
 *
 * Chrome neutre (pas de halo-on-hover), labels en voix régulière FR (.t-11).
 */

import { type JSX, useMemo } from "react";
import { type Source, SourceCitation } from "@/app/(user)/components/SourceCitation";
import type { RenderedBlock, RenderPayload } from "@/lib/reports/engine/render-blocks";
import { BlockRenderer } from "./BlockRenderer";

interface ReportGridProps {
  payload: RenderPayload;
  visibleBlocks: ReadonlyArray<RenderedBlock>;
}

export function ReportGrid({ payload, visibleBlocks }: ReportGridProps): JSX.Element {
  // B4 — citations cliquables. Le payload porte un champ `sources`
  // (typé optionnel, dérivé de spec.sources par run-report.ts). On wrap la
  // grille dans SourceCitation qui détecte les `<sup data-source-id="..."/>`
  // rendus par les blocks (ex. KpiTile.captionHtml généré via fmtCitation).
  const reportSources: ReadonlyArray<Source> = useMemo(() => {
    const raw = payload.sources;
    return Array.isArray(raw) ? raw : [];
  }, [payload]);

  return (
    <SourceCitation sources={reportSources}>
      <div
        className="grid w-full"
        style={{
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: "var(--space-4)",
        }}
      >
        {visibleBlocks.map((block) => (
          <div
            key={block.id}
            style={{ gridColumn: `span ${block.layout.col}` }}
            className="flex flex-col"
          >
            {block.label && block.type !== "kpi" && (
              <div
                className="t-11 font-medium text-text-muted"
                style={{
                  marginBottom: "var(--space-3)",
                  paddingBottom: "var(--space-2)",
                  borderBottom: "1px solid var(--surface-2)",
                }}
              >
                {block.label}
              </div>
            )}
            <BlockRenderer block={block} />
          </div>
        ))}
      </div>
    </SourceCitation>
  );
}
