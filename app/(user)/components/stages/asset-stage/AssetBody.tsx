"use client";

import { isHtmlContent, tryParseReportPayload } from "@/lib/assets/content-parser";
import { ReportLayout } from "../../ReportLayout";
import { ResearchReportArticle } from "../../reports/ResearchReportArticle";

interface AssetBodyProps {
  contentRef?: string;
  title: string;
  /**
   * ID de l'asset porteur. Quand fourni, les actions Exporter / Partager /
   * Commenter apparaissent dans le header de ReportLayout (cf. ReportLayout
   * props.assetId). Optionnel pour conserver la compat des autres callers.
   */
  assetId?: string;
}

/**
 * AssetBody — Sélectionne le rendu en fonction du format détecté.
 *
 * Trois branches via les helpers `tryParseReportPayload` / `isHtmlContent` :
 *   1. ReportPayload JSON → <ReportLayout> (grille blocs structurés)
 *   2. HTML → <iframe sandbox> (rapports HTML générés)
 *   3. Plain text / markdown → <ResearchReportArticle> (briefs free-form)
 */
export function AssetBody({ contentRef, title, assetId }: AssetBodyProps) {
  if (!contentRef) {
    return (
      <p className="t-13 font-light text-text-muted">Aucun contenu disponible pour cet asset.</p>
    );
  }

  const reportPayload = tryParseReportPayload(contentRef);
  if (reportPayload) {
    return <ReportLayout payload={reportPayload} assetId={assetId} assetTitle={title} />;
  }

  if (isHtmlContent(contentRef)) {
    return (
      <iframe
        title={title}
        srcDoc={contentRef}
        sandbox="allow-same-origin"
        className="w-full rounded-sm border border-[var(--surface-2)] bg-[var(--surface-1)]"
        style={{ height: "var(--space-32)", minHeight: "var(--height-focal-min)" }}
      />
    );
  }

  return <ResearchReportArticle content={contentRef} />;
}
