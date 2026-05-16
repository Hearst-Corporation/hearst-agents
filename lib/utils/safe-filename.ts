/**
 * F-055: Safe Content-Disposition header — prevent CRLF injection + MIME filename
 *
 * Sanitise les noms de fichiers en supprimant CR/LF/quote/backslash
 * et en tronquant à 200 chars.
 */

export function safeFilename(name: string): string {
  // Supprime CR/LF/quote/backslash pour prévenir l'injection CRLF
  const sanitized = String(name)
    .replace(/[\r\n"\\]/g, "_")
    .slice(0, 200);
  return sanitized;
}
