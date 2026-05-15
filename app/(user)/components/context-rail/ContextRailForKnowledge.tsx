"use client";

/**
 * Sub-rail Stage "kg" (Knowledge Graph) — focus entity + résumé du graphe.
 */

import { useStageData } from "@/stores/stage-data";
import { EmptyHint, Section } from "./Section";

export function ContextRailForKnowledge() {
  const { graph, selectedNode } = useStageData((s) => s.kg);
  return (
    <div className="h-full overflow-y-auto">
      <Section label="Focus entity">
        {selectedNode ? (
          <div className="flex flex-col gap-3">
            <span className="t-9 font-medium text-(--accent-teal)">{selectedNode.type}</span>
            <p className="t-13 font-light text-text-soft">{selectedNode.label}</p>
            {Object.keys(selectedNode.properties ?? {}).length > 0 && (
              <ul className="flex flex-col gap-2 mt-3">
                {Object.entries(selectedNode.properties as Record<string, unknown>)
                  .slice(0, 6)
                  .map(([k, v]) => (
                    <li key={k} className="flex items-baseline gap-3">
                      <span className="t-9 font-medium text-text-ghost truncate">{k}</span>
                      <span className="t-11 font-light text-text-muted truncate">{String(v)}</span>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        ) : (
          <EmptyHint>Click a graph node</EmptyHint>
        )}
      </Section>
      <Section label="Graph" count={graph.nodes.length}>
        <p className="t-9 font-light text-text-faint">
          {graph.nodes.length} entities · {graph.edges.length} relations
        </p>
      </Section>
    </div>
  );
}
