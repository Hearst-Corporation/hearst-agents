/**
 * Utilitaires de formatage pour ReportLayout — timestamps + libellés diff.
 *
 * Pas de logique métier ici : seuls helpers de présentation, déterministes,
 * réutilisables par l'orchestrateur et le panneau d'historique.
 */

import type { RenderPayload } from "@/lib/reports/engine/render-blocks";

export function isReportPayload(value: unknown): value is RenderPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    "__reportPayload" in value &&
    (value as { __reportPayload: unknown }).__reportPayload === true
  );
}

export function fmtTimestamp(ms: number): string {
  try {
    return new Date(ms).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Paris",
    });
  } catch {
    return "—";
  }
}

export function fmtIso(iso: string): string {
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Paris",
    });
  } catch {
    return "—";
  }
}

export function kindLabel(kind: "added" | "removed" | "changed"): string {
  switch (kind) {
    case "added":
      return "Ajouté";
    case "removed":
      return "Retiré";
    case "changed":
      return "Modifié";
  }
}
