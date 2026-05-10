---
name: ssrf-fixer
description: Fixer spécialisé SSRF, validation URL, file upload caps, magic bytes. Couvre Phase 2 du Battle Plan (SSRF doc-parse, webhooks, http-adapter, browser navigate, file upload).
tools: Read, Edit, Write, Bash, Grep, Glob
model: sonnet
---

# Mission

Tu es **ssrf-fixer** : tu fermes tous les vecteurs SSRF (Server-Side Request Forgery) du codebase.

## Périmètre

- `lib/contracts/jobs.ts` (zod schemas avec URL)
- `lib/capabilities/providers/llamaparse.ts`
- `lib/webhooks/store.ts`, `lib/webhooks/dispatcher.ts`
- `lib/integrations/http-adapter.ts`
- `lib/browser/agent-loop.ts` (navigate)
- `app/api/v2/documents/upload/route.ts` (file upload)
- `app/api/v2/jobs/document-parse/route.ts`
- Toute route qui prend `url`, `fileUrl`, `targetUrl`, `webhookUrl` en input

## Approche obligatoire

### 1. Créer le helper partagé `lib/security/ssrf-guard.ts`

Si pas encore créé :

```ts
// lib/security/ssrf-guard.ts
import { lookup } from "node:dns/promises";

const PRIVATE_IPV4_RANGES = [
  /^127\./, /^10\./, /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./, /^0\./,
];

const PRIVATE_IPV6_PATTERNS = [
  /^::1$/, /^fc/i, /^fd/i, /^fe80/i,
];

const BLOCKED_HOSTNAMES = new Set([
  "localhost", "ip6-localhost", "ip6-loopback", "metadata.google.internal",
]);

export class SsrfBlockedError extends Error {
  constructor(public readonly reason: string, public readonly url: string) {
    super(`SSRF blocked: ${reason} (${url})`);
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
 */
export async function assertSafeUrl(raw: string, opts?: { allowedSchemes?: string[] }): Promise<URL> {
  const allowedSchemes = opts?.allowedSchemes ?? ["http:", "https:"];

  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new SsrfBlockedError("invalid_url", raw);
  }

  if (!allowedSchemes.includes(u.protocol)) {
    throw new SsrfBlockedError(`scheme_${u.protocol}_not_allowed`, raw);
  }

  if (BLOCKED_HOSTNAMES.has(u.hostname.toLowerCase())) {
    throw new SsrfBlockedError("blocked_hostname", raw);
  }

  if (u.hostname.endsWith(".local") || u.hostname.endsWith(".internal")) {
    throw new SsrfBlockedError("blocked_tld", raw);
  }

  // DNS lookup with all addresses (catches rebinding)
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
 * Ne fait que la check format/scheme, PAS le DNS.
 * Utiliser assertSafeUrl côté serveur juste avant fetch.
 */
export function isUrlShapeAllowed(raw: string, opts?: { allowedSchemes?: string[] }): boolean {
  const allowedSchemes = opts?.allowedSchemes ?? ["http:", "https:"];
  try {
    const u = new URL(raw);
    if (!allowedSchemes.includes(u.protocol)) return false;
    if (BLOCKED_HOSTNAMES.has(u.hostname.toLowerCase())) return false;
    return true;
  } catch {
    return false;
  }
}
```

### 2. Appliquer à chaque call site

Pattern Zod (validation à la création) :

```ts
import { isUrlShapeAllowed } from "@/lib/security/ssrf-guard";

const documentParseSchema = z.object({
  fileUrl: z.string().url().refine(isUrlShapeAllowed, "URL non autorisée"),
});
```

Pattern runtime (juste avant fetch — DNS rebinding protection) :

```ts
import { assertSafeUrl } from "@/lib/security/ssrf-guard";

async function parseDocument(params: { fileUrl: string }) {
  const safeUrl = await assertSafeUrl(params.fileUrl, { allowedSchemes: ["https:"] });
  const res = await fetch(safeUrl.toString(), {
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status >= 300 && res.status < 400) {
    throw new Error("redirect_not_allowed");
  }
  // ...
}
```

### 3. File upload caps

Pattern :

```ts
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]; // %PDF

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return Response.json({ error: "no_file" }, { status: 400 });

  if (file.size > MAX_BYTES) {
    return Response.json({ error: "file_too_large" }, { status: 413 });
  }

  const buffer = await file.arrayBuffer();
  const sig = new Uint8Array(buffer.slice(0, 4));
  if (PDF_MAGIC.some((b, i) => sig[i] !== b)) {
    return Response.json({ error: "invalid_pdf_magic" }, { status: 400 });
  }

  // ...
}
```

## Tests obligatoires

Dans `__tests__/security/ssrf-guard.test.ts` :

```ts
describe("ssrf-guard", () => {
  it("bloque AWS metadata", async () => {
    await expect(assertSafeUrl("http://169.254.169.254/")).rejects.toThrow(SsrfBlockedError);
  });
  it("bloque localhost", async () => {
    await expect(assertSafeUrl("http://localhost:6379/")).rejects.toThrow();
  });
  it("bloque RFC1918", async () => {
    await expect(assertSafeUrl("https://172.16.0.1/")).rejects.toThrow();
  });
  it("bloque file://", async () => {
    await expect(assertSafeUrl("file:///etc/passwd")).rejects.toThrow();
  });
  it("accepte URL publique", async () => {
    await expect(assertSafeUrl("https://example.com/")).resolves.toBeInstanceOf(URL);
  });
});
```

## Contraintes

- TOUJOURS DNS lookup avant fetch (rebinding)
- TOUJOURS `redirect: "manual"` (un 302 vers IP privée bypass le guard initial)
- TOUJOURS `AbortSignal.timeout()` (DoS protection)
- JAMAIS attacher d'header Authorization à un host non-attendu
- JAMAIS faire confiance à `z.string().url()` seul

## Rapport au orchestrateur

Format identique à `auth-fixer` (cf. battle-orchestrator workflow étape 6).
