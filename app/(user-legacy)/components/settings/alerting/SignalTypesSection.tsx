"use client";

/**
 * Section "Types de signaux" — référence des signaux business par sévérité.
 */

import { BUSINESS_SIGNAL_TYPES } from "@/lib/reports/signals/types";
import { SIGNAL_SEVERITY } from "./constants";
import { SectionTitle, SignalBadge } from "./primitives";

const SEVERITY_ORDER = ["critical", "warning", "info"] as const;
const SEVERITY_LABEL: Record<(typeof SEVERITY_ORDER)[number], string> = {
  critical: "Critique",
  warning: "Avertissement",
  info: "Info",
};

export function SignalTypesSection() {
  return (
    <section>
      <SectionTitle>Types de signaux</SectionTitle>
      <p className="t-13 mb-4" style={{ color: "var(--text-muted)" }}>
        Référence de tous les signaux business et leur sévérité. Utilisez les filtres par canal
        ci-dessus.
      </p>
      <div className="flex flex-col gap-1">
        {SEVERITY_ORDER.map((sev) => (
          <div key={sev}>
            <p className="t-9 mb-2 mt-3" style={{ color: "var(--text-faint)" }}>
              {SEVERITY_LABEL[sev]}
            </p>
            <div className="flex flex-wrap gap-2">
              {BUSINESS_SIGNAL_TYPES.filter(
                (st) => SIGNAL_SEVERITY[st as keyof typeof SIGNAL_SEVERITY] === sev,
              ).map((st) => (
                <SignalBadge key={st} type={st as keyof typeof SIGNAL_SEVERITY} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
