/**
 * ReportMetaFooter — footer technique : version + timestamp de génération.
 *
 * Voix éditoriale FR, t-11 light text-faint, séparateur surface-2.
 */

import type { JSX } from "react";
import type { RenderPayload } from "@/lib/reports/engine/render-blocks";
import { fmtTimestamp } from "./utils";

export function ReportMetaFooter({ payload }: { payload: RenderPayload }): JSX.Element {
  return (
    <div
      className="flex items-center"
      style={{
        gap: "var(--space-6)",
        marginTop: "var(--space-8)",
        paddingTop: "var(--space-4)",
        borderTop: "1px solid var(--surface-2)",
      }}
    >
      <span className="t-11 font-light text-text-faint">Version {payload.version}</span>
      <span className="t-11 font-light text-text-faint">
        Généré · {fmtTimestamp(payload.generatedAt)}
      </span>
    </div>
  );
}
