"use client";

/**
 * Sub-rail Stage "simulation" — variables d'entrée + scénarios générés
 * par DeepSeek (probabilités).
 */

import { useStageData } from "@/stores/stage-data";
import { Section, EmptyHint } from "./Section";

export function ContextRailForSimulation() {
  const { variables, scenarios, phase } = useStageData((s) => s.simulation);
  const cleanVars = variables.filter((v) => v.key.trim());
  return (
    <div className="h-full overflow-y-auto">
      <Section label="Variables" count={cleanVars.length}>
        {cleanVars.length === 0 ? (
          <EmptyHint>Define inputs in the form</EmptyHint>
        ) : (
          <ul className="flex flex-col gap-3">
            {cleanVars.map((v, i) => (
              <li key={i} className="flex items-baseline gap-3">
                <span className="t-9 font-medium text-text-ghost truncate">
                  {v.key}
                </span>
                <span className="t-13 font-light text-text-soft truncate">
                  {v.value || "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section label="Generated scenarios" count={scenarios.length}>
        {scenarios.length === 0 ? (
          <EmptyHint>
            {phase === "running" ? "DeepSeek thinking…" : "No scenarios"}
          </EmptyHint>
        ) : (
          <ul className="flex flex-col gap-3">
            {scenarios.map((s, i) => (
              <li
                key={i}
                className="border-l border-[var(--accent-teal-border)] pl-4 py-1"
              >
                <p className="t-13 font-light text-text-soft truncate mb-1">{s.name}</p>
                <p className="t-9 font-medium text-text-ghost">
                  PROB · {(s.probability * 100).toFixed(0)}%
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>

    </div>
  );
}
