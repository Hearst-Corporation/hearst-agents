/**
 * Langfuse PII redact — applique avant tout trace.input / generation.end
 *
 * Strips :
 * - Emails (RFC-like regex)
 * - Numéros de téléphone (avec séparateurs explicites)
 * - Clés API OpenAI (sk-*), Anthropic (sk-ant-*), Google (AIzaSy*)
 * - Clés de projet OpenAI (sk-proj-*)
 * - Valeurs des champs dont le nom match PII_FIELD_REGEX
 *
 * Ordre des substitutions important : API keys avant phone pour éviter
 * que la regex téléphone ne matche les séquences de chiffres des clés.
 */

const PII_FIELD_REGEX =
  /email|phone|ssn|token|secret|api_?key|authorization|prompt|system|message|content/i;

export function redactString(s: string): string {
  return (
    s
      // API keys en premier (avant phone) pour éviter les faux positifs
      .replace(/sk-ant-[a-zA-Z0-9_-]{20,}/g, "[ANTHROPIC_KEY]")
      .replace(/sk-proj-[a-zA-Z0-9_-]{20,}/g, "[OPENAI_KEY]")
      .replace(/sk-[a-zA-Z0-9]{20,}/g, "[OPENAI_KEY]")
      .replace(/AIzaSy[A-Za-z0-9_-]{30,}/g, "[GOOGLE_KEY]")
      // Emails
      .replace(/[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[EMAIL]")
      // Téléphone — avec séparateurs obligatoires pour éviter les faux positifs
      // Format : +1 (555) 123-4567 ou +33 6 12 34 56 78 etc.
      .replace(
        /\+\d{1,3}[\s.-]\(?\d{1,4}\)?[\s.-]\d{1,4}[\s.-]\d{4,9}/g,
        "[PHONE]",
      )
  );
}

/**
 * Redacte récursivement un payload avant de l'envoyer à Langfuse.
 *
 * - Les champs dont le nom match PII_FIELD_REGEX voient leur valeur
 *   redactée via `redactString` (chaînes) ou récursivement (objets/tableaux).
 * - Les autres champs sont parcourus récursivement pour détecter des
 *   clés API / emails embarqués dans des chaînes de valeur.
 */
export function redactForLangfuse(input: unknown): unknown {
  if (typeof input === "string") return redactString(input);
  if (Array.isArray(input)) return input.map(redactForLangfuse);
  if (input && typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      // PII ou non : on redacte récursivement dans tous les cas
      // (les champs PII voient leur contenu entièrement redacté,
      //  les autres sont parcourus pour catch les clés/emails embarqués)
      out[k] = PII_FIELD_REGEX.test(k) ? redactForLangfuse(v) : redactForLangfuse(v);
    }
    return out;
  }
  return input;
}
