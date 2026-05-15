/**
 * Extrait un bloc de code depuis l'input utilisateur.
 *
 * Détecte d'abord un fenced block ```lang … ``` ; sinon fallback sur le
 * texte brut interprété comme Python (default sandbox runtime).
 */
export function extractCodeBlock(value: string): {
  code: string;
  runtime: "python" | "node";
} | null {
  const fenced = value.match(/```(\w+)?\n([\s\S]*?)```/);
  if (fenced) {
    const lang = (fenced[1] ?? "").toLowerCase();
    const runtime: "python" | "node" =
      lang === "js" || lang === "javascript" || lang === "node" || lang === "typescript"
        ? "node"
        : "python";
    return { code: fenced[2].trim(), runtime };
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  return { code: trimmed, runtime: "python" };
}
