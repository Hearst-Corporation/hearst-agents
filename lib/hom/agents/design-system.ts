/**
 * A2 Design System Agent — scan tokens, voix éditoriale, magic values.
 * Délègue les détections fines à `lib/hom/drift.ts` puis convertit en findings.
 */
import { scanDrift, appendDriftLog } from "../drift";
import type { Finding, Severity } from "../types";
import { runAgent, makeFindingId, type AgentExecCtx, type ScanResult } from "./base";

const SEVERITY_MAP: Record<string, Severity> = {
  hardcoded_color: "high",
  hardcoded_spacing: "low",
  inline_style: "medium",
  forbidden_token: "medium",
  ds_violation: "medium",
  orphan_component: "low",
};

export async function scanDesignSystem(ctx: AgentExecCtx): Promise<ScanResult> {
  const drift = await scanDrift({ runId: ctx.runId, agent: "design-system" });
  await appendDriftLog(drift);

  const findings: Finding[] = drift.map((d) => ({
    id: makeFindingId(),
    agent: "design-system",
    severity: SEVERITY_MAP[d.type] ?? "low",
    title: titleFor(d.type),
    detail: `${d.file}:${d.line ?? "?"} — ${d.snippet}`,
    evidence: [`${d.file}:${d.line ?? "?"}`],
    scope: d.file,
  }));

  return {
    findings,
    files_scanned: new Set(drift.map((d) => d.file)).size,
  };
}

function titleFor(type: string): string {
  switch (type) {
    case "hardcoded_color":
      return "Couleur hardcodée hors token";
    case "hardcoded_spacing":
      return "Spacing hors grille --space-*";
    case "inline_style":
      return "Inline style avec valeur raw";
    case "ds_violation":
      return "Voix éditoriale violée (mono caps / halo on hover)";
    case "orphan_component":
      return "Composant orphelin";
    default:
      return type;
  }
}

export async function executeDesignSystem(ctx: AgentExecCtx) {
  return runAgent("design-system", ctx, scanDesignSystem);
}
