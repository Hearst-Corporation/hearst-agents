/**
 * SSRF Guard — protection contre les Server-Side Request Forgery.
 *
 * - assertSafeUrl() : async, effectue DNS lookup (rebinding protection)
 * - isUrlShapeAllowed() : sync, validation format seule (pour Zod .refine)
 * - SsrfBlockedError : erreur typée levée par assertSafeUrl
 *
 * DEFENSE EN PROFONDEUR :
 * 1. Validation schéma Zod à l'entrée → isUrlShapeAllowed
 * 2. DNS lookup juste avant fetch → assertSafeUrl
 * 3. redirect:'manual' sur chaque fetch → pas de bypass 302 vers IP privée
 * 4. AbortSignal.timeout() sur chaque fetch → protection DoS
 */

import { lookup } from "node:dns/promises";

const PRIVATE_IPV4_RANGES = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^0\./,
];

const PRIVATE_IPV6_PATTERNS = [/^::1$/, /^fc/i, /^fd/i, /^fe80/i];

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "ip6-localhost",
  "ip6-loopback",
  "metadata.google.internal",
]);

export class SsrfBlockedError extends Error {
  constructor(
    public readonly reason: string,
    public readonly url: string,
  ) {
    super(`SSRF blocked: ${reason} (${url})`);
    this.name = "SsrfBlockedError";
  }
}

function isPrivateIpv4(ip: string): boolean {
  return PRIVATE_IPV4_RANGES.some((re) => re.test(ip));
}

function isPrivateIpv6(ip: string): boolean {
  return PRIVATE_IPV6_PATTERNS.some((re) => re.test(ip));
}

/**
 * Valide qu'une URL ne pointe pas vers un IP privé / link-local.
 * Effectue DNS lookup pour empêcher DNS rebinding.
 *
 * TOUJOURS appeler juste avant fetch().
 * TOUJOURS utiliser redirect:'manual' + AbortSignal.timeout() sur le fetch suivant.
 */
export async function assertSafeUrl(
  raw: string,
  opts?: { allowedSchemes?: string[] },
): Promise<URL> {
  const allowedSchemes = opts?.allowedSchemes ?? ["http:", "https:"];

  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new SsrfBlockedError("invalid_url", raw);
  }

  if (!allowedSchemes.includes(u.protocol)) {
    throw new SsrfBlockedError(`scheme_${u.protocol.replace(":", "")}_not_allowed`, raw);
  }

  if (BLOCKED_HOSTNAMES.has(u.hostname.toLowerCase())) {
    throw new SsrfBlockedError("blocked_hostname", raw);
  }

  if (u.hostname.endsWith(".local") || u.hostname.endsWith(".internal")) {
    throw new SsrfBlockedError("blocked_tld", raw);
  }

  // Bloque les IP littérales sans passer par DNS
  if (isPrivateIpv4(u.hostname)) {
    throw new SsrfBlockedError(`private_ipv4_literal_${u.hostname}`, raw);
  }
  // IPv6 littéral (entre crochets dans l'URL)
  const ipv6Host = u.hostname.replace(/^\[|\]$/g, "");
  if (isPrivateIpv6(ipv6Host)) {
    throw new SsrfBlockedError(`private_ipv6_literal_${ipv6Host}`, raw);
  }

  // DNS lookup avec toutes les adresses (catch DNS rebinding)
  let addrs: { address: string; family: number }[];
  try {
    addrs = await lookup(u.hostname, { all: true });
  } catch {
    throw new SsrfBlockedError("dns_lookup_failed", raw);
  }

  for (const { address, family } of addrs) {
    if (family === 4 && isPrivateIpv4(address)) {
      throw new SsrfBlockedError(`private_ipv4_${address}`, raw);
    }
    if (family === 6 && isPrivateIpv6(address)) {
      throw new SsrfBlockedError(`private_ipv6_${address}`, raw);
    }
  }

  return u;
}

/**
 * Variante synchrone pour validation Zod (.refine).
 * Ne fait QUE la vérification format/scheme — PAS de DNS.
 *
 * Utiliser assertSafeUrl() côté serveur juste avant fetch.
 */
export function isUrlShapeAllowed(raw: string, opts?: { allowedSchemes?: string[] }): boolean {
  const allowedSchemes = opts?.allowedSchemes ?? ["http:", "https:"];
  try {
    const u = new URL(raw);
    if (!allowedSchemes.includes(u.protocol)) return false;
    if (BLOCKED_HOSTNAMES.has(u.hostname.toLowerCase())) return false;
    if (u.hostname.endsWith(".local") || u.hostname.endsWith(".internal")) return false;
    // Bloque les IP privées littérales (pas de DNS ici)
    if (isPrivateIpv4(u.hostname)) return false;
    const ipv6Host = u.hostname.replace(/^\[|\]$/g, "");
    if (isPrivateIpv6(ipv6Host)) return false;
    return true;
  } catch {
    return false;
  }
}
