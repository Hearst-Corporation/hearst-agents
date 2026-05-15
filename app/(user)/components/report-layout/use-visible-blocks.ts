/**
 * useVisibleBlocks — calcule la liste des blocks à afficher en respectant le
 * spec courant : filtre les blocks `hidden:true` et ré-applique l'ordre du
 * spec si fourni. Le payload reste source de vérité pour les données.
 */

import { useMemo } from "react";
import type { RenderedBlock, RenderPayload } from "@/lib/reports/engine/render-blocks";
import type { ReportSpec } from "@/lib/reports/spec/schema";

export function useVisibleBlocks(
  payload: RenderPayload,
  spec: ReportSpec | undefined,
): ReadonlyArray<RenderedBlock> {
  const hiddenIds = useMemo(() => {
    if (!spec) return new Set<string>();
    return new Set(spec.blocks.filter((b) => b.hidden).map((b) => b.id));
  }, [spec]);

  const orderedBlocks = useMemo(() => {
    if (!spec) return payload.blocks;
    const byId = new Map(payload.blocks.map((b) => [b.id, b]));
    return spec.blocks
      .filter((b) => !b.hidden)
      .map((b) => byId.get(b.id))
      .filter((b): b is RenderedBlock => Boolean(b));
  }, [spec, payload.blocks]);

  return spec ? orderedBlocks : payload.blocks.filter((b) => !hiddenIds.has(b.id));
}
