import { type NextRequest, NextResponse } from "next/server";
import type { ZodSchema } from "zod";

export type ParseBodyResult<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

/** Default max payload size (64KB) — covers typical JSON API bodies. */
const DEFAULT_MAX_BYTES = 64 * 1024;

export interface ParseJsonBodyOptions {
  /**
   * Max allowed body size in bytes. Requests with `Content-Length` exceeding
   * this value short-circuit with a 413 response. Defaults to 64KB.
   *
   * Limitation : la garde s'applique uniquement quand l'en-tête
   * `Content-Length` est présent. Un client envoyant
   * `Transfer-Encoding: chunked` sans `Content-Length` contournerait la
   * vérification — la dernière barrière reste alors la limite imposée par le
   * runtime (Next.js / edge / node) à `req.json()`.
   */
  maxBytes?: number;
}

/**
 * Parse + validate request JSON body with a Zod schema.
 *
 * On success: returns `{ ok: true, data }`.
 * On parse/validation failure: returns `{ ok: false, response }` with 400 +
 * uniform error shape `{ error: "invalid_body", issues: <flatten> }`.
 *
 * Guards (returned as `{ ok: false, response }`):
 *  - 415 `unsupported_media_type` if Content-Type media-type is not
 *    `application/json` (comparaison case-insensitive — RFC 7231 §3.1.1.1)
 *  - 413 `payload_too_large` if `Content-Length` is present and exceeds
 *    `options.maxBytes` (default 64KB). Voir `ParseJsonBodyOptions.maxBytes`
 *    pour le caveat sur les requêtes `Transfer-Encoding: chunked`.
 *
 * Replaces the ~7-line repeated pattern across 31 routes (see AUDIT-2 DUP13).
 * Uniformizes error code: `"invalid_body"` (was 5 different codes).
 */
export async function parseJsonBody<T>(
  req: Request | NextRequest,
  schema: ZodSchema<T>,
  options?: ParseJsonBodyOptions,
): Promise<ParseBodyResult<T>> {
  const contentType = req.headers.get("content-type") ?? "";
  // RFC 7231 §3.1.1.1 — media type tokens are case-insensitive.
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "unsupported_media_type", expected: "application/json" },
        { status: 415 },
      ),
    };
  }

  const maxBytes = options?.maxBytes ?? DEFAULT_MAX_BYTES;
  const contentLengthHeader = req.headers.get("content-length");
  if (contentLengthHeader !== null) {
    const contentLength = Number(contentLengthHeader);
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      return {
        ok: false,
        response: NextResponse.json({ error: "payload_too_large", maxBytes }, { status: 413 }),
      };
    }
  }

  const raw = await req.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "invalid_body", issues: parsed.error.flatten() },
        { status: 400 },
      ),
    };
  }
  return { ok: true, data: parsed.data };
}
