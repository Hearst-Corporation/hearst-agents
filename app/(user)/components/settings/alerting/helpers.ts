/**
 * Helpers purs pour AlertingSettings.
 */

export function parseEmailInput(raw: string): string[] {
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.includes("@"));
}
