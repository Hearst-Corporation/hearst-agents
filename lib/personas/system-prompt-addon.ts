/**
 * Build le bloc `<persona>...</persona>` injecté dans le system prompt.
 *
 * Placé en zone cacheable (avant `<retrieved_memory>`) → si la persona
 * reste stable entre tours, le prompt cache Anthropic ephemeral garde le
 * tag persona dans le hit.
 *
 * Cap strict 1500 chars pour éviter qu'une style guide longue éclate
 * le budget de cache.
 *
 * F-115 — sanitize systemPromptAddon avant injection pour bloquer les
 * tentatives de prompt injection via les personas utilisateur.
 */

import type { Persona } from "./types";

const ADDON_MAX_CHARS = 1500;

/**
 * Patterns de prompt injection détectés dans systemPromptAddon.
 * Si l'un matche → le champ est remplacé par une chaîne vide.
 * Conservateur : n'affecte que les jailbreak flagrants, pas le texte légitime.
 */
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/i,
  /\bsystem\s*prompt\b/i,
  /<\/?system>/i,
  /\byou\s+are\s+now\b/i,
  /\bforget\s+(your|all)\b/i,
  /\bact\s+as\s+(an?\s+)?(?:unrestricted|jailbreak|DAN)\b/i,
  // Fermeture de balise persona pour sortir du bloc XML
  /<\/persona>/i,
  /<\/?instruction>/i,
];

/**
 * Nettoie un champ texte de persona (description, tone, styleGuide) avant
 * injection dans le bloc <persona>. Contrairement à sanitizeAddon, ne rejette
 * pas le champ entier — strip uniquement les sous-chaînes dangereuses pour
 * éviter les break-outs XML et les injections de balises système.
 * - Retire les caractères de contrôle (hors \n et \t)
 * - Strip les patterns d'injection (remplacés par "")
 * - Cap à 500 chars (les champs courts n'ont pas besoin de plus)
 */
function sanitizeTextField(raw: string, cap = 500): string {
  const stripped = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\x80-\x9F]/g, "");
  let safe = stripped;
  for (const pattern of INJECTION_PATTERNS) {
    safe = safe.replace(pattern, "");
  }
  return safe.trim().slice(0, cap);
}

/**
 * Nettoie un systemPromptAddon avant injection dans le system prompt.
 * - Retire les caractères de contrôle (hors \n et \t)
 * - Echappe les balises XML dangereuses residuelles
 * - Rejette si un pattern injection est détecté
 * - Cap à ADDON_MAX_CHARS (défense en profondeur, Zod le fait déjà côté API)
 */
function sanitizeAddon(raw: string): string {
  // Retire les chars de contrôle (U+0000-U+001F sauf \n \t, U+007F, U+0080-U+009F)
  const stripped = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\x80-\x9F]/g, "");

  // Détection injection — rejeter le champ entier si match
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(stripped)) {
      console.warn("[Persona] systemPromptAddon rejeté (injection pattern détecté):", pattern);
      return "";
    }
  }

  // Cap
  return stripped.slice(0, ADDON_MAX_CHARS);
}

function joinList(values: string[] | undefined): string | null {
  if (!values || values.length === 0) return null;
  return values.slice(0, 12).join(", ");
}

export function buildPersonaAddon(persona: Persona): string {
  const lines: string[] = [];
  lines.push(`Persona active : ${persona.name}.`);
  if (persona.description?.trim()) {
    const safeDescription = sanitizeTextField(persona.description.trim());
    if (safeDescription) {
      lines.push(safeDescription);
    }
  }
  if (persona.tone) {
    const safeTone = sanitizeTextField(persona.tone, 200);
    if (safeTone) {
      lines.push(`Ton : ${safeTone}.`);
    }
  }
  const preferred = joinList(persona.vocabulary?.preferred);
  if (preferred) {
    lines.push(`Vocabulaire préféré : ${preferred}.`);
  }
  const avoid = joinList(persona.vocabulary?.avoid);
  if (avoid) {
    lines.push(`À éviter : ${avoid}.`);
  }
  if (persona.styleGuide?.trim()) {
    const safeStyleGuide = sanitizeTextField(persona.styleGuide.trim());
    if (safeStyleGuide) {
      lines.push(`Style guide : ${safeStyleGuide}`);
    }
  }
  if (persona.systemPromptAddon?.trim()) {
    const sanitized = sanitizeAddon(persona.systemPromptAddon.trim());
    if (sanitized) {
      lines.push(sanitized);
    }
  }

  const body = lines.join("\n").slice(0, ADDON_MAX_CHARS);
  return `<persona>\n${body}\n</persona>`;
}

/**
 * Variante : retourne `null` si la persona est strictement vide
 * (rien à injecter → on évite d'ajouter un bloc vide au prompt).
 */
export function buildPersonaAddonOrNull(persona: Persona | null | undefined): string | null {
  if (!persona) return null;
  const hasContent =
    Boolean(persona.tone) ||
    Boolean(persona.styleGuide?.trim()) ||
    Boolean(persona.systemPromptAddon?.trim()) ||
    Boolean(persona.vocabulary?.preferred?.length) ||
    Boolean(persona.vocabulary?.avoid?.length) ||
    Boolean(persona.description?.trim());
  if (!hasContent) return null;
  return buildPersonaAddon(persona);
}
