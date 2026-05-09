/**
 * Sanitize a string for use as a filename.
 *
 * Strips diacritics (NFD normalization) then replaces every char that is not
 * `a-zA-Z0-9-_` by `_`. Truncates at 60 chars. Returns `"report"` if the
 * resulting string is empty.
 */
export function safeFileName(s: string): string {
  return (
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9-_]+/g, "_")
      .slice(0, 60) || "report"
  );
}
