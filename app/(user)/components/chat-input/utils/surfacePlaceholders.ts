/**
 * Placeholders du textarea selon la surface active du cockpit.
 * Fallback : "Ask anything…".
 */
export const SURFACE_PLACEHOLDERS: Record<string, string> = {
  home: "Ask anything",
  inbox: "Search a message…",
  calendar: "Ask about your schedule",
  files: "Find a document…",
  tasks: "Create a mission…",
  apps: "Configure your connectors…",
};

export function resolvePlaceholder(
  surface: string,
  override?: string,
): string {
  return override || SURFACE_PLACEHOLDERS[surface] || "Ask anything…";
}
