/**
 * Themes — types partagés entre registry, picker, API et hydrator.
 *
 * Chaque entrée du registry décrit un thème scopé via `data-theme="<slug>"`
 * sur `<html>`. Les tokens vivent dans `themes/<slug>/tokens.css`.
 */

export interface Theme {
  slug: string;
  name: string;
  source: string | null;
  preview: string;
  cssPath: string;
  capturedAt?: string;
  description?: string;
}
