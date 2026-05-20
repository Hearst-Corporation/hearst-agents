/**
 * Format ISO 8601 date string to localized en-US display.
 */
export function formatDate(
  iso: string | null | undefined,
  options: { withSeconds?: boolean; withYear?: boolean } = {},
): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      day: "2-digit",
      month: "short",
      year: options.withYear ? "numeric" : undefined,
      hour: "2-digit",
      minute: "2-digit",
      second: options.withSeconds ? "2-digit" : undefined,
    });
  } catch {
    return iso;
  }
}
