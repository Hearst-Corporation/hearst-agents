/**
 * Placeholders du textarea selon la surface active du cockpit.
 * Fallback : "Demande quelque chose à Hearst…".
 */
const SURFACE_PLACEHOLDERS: Record<string, string> = {
  home: "Demande quelque chose à Hearst…",
  inbox: "Rechercher un message…",
  calendar: "Demande quelque chose sur ton agenda…",
  files: "Trouver un document…",
  tasks: "Créer une mission…",
  apps: "Configurer tes connecteurs…",
};

export function resolvePlaceholder(surface: string, override?: string): string {
  return override || SURFACE_PLACEHOLDERS[surface] || "Demande quelque chose à Hearst…";
}
