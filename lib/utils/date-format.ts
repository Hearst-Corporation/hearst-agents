/**
 * Format a timestamp as `HH:MM` (24h, local timezone).
 * Returns `"--:--"` for null/undefined/invalid input.
 */
export function formatHHMM(ts: number | null | undefined): string {
  if (!ts) return "--:--";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "--:--";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
