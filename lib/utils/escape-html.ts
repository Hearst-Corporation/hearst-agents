/**
 * HTML entity escaping for user-supplied content.
 *
 * Replaces 3 dispersed implementations (see AUDIT-2 DUP1).
 * Escapes `& < > " '` for safe embedding in HTML.
 */

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * Escape HTML entities `& < > " '` for safe embedding in raw HTML output
 * (e.g. server-rendered HTML strings, email templates, manual `innerHTML`,
 * PDF/print pipelines that bypass React).
 *
 * DO NOT USE in JSX/TSX components: React already escapes text children
 * automatically. Applying `escapeHtml` on a JSX child produces double-escape
 * (e.g. "Café & co" displays as "Café &amp; co"). Reserve this helper for
 * contexts that bypass React's auto-escape.
 */
export function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch] ?? ch);
}
