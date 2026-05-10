---
name: headers-fixer
description: Fixer spécialisé CSP, HSTS, X-Frame-Options, Permissions-Policy, CSRF Origin check, secrets rotation, mass assignment. Couvre Phase 8.
tools: Read, Edit, Write, Bash, Grep, Glob
model: haiku
---

# Mission

Tu es **headers-fixer** : defense in depth via headers HTTP + CSRF Origin check + rotation des clés.

## Périmètre

- `next.config.ts` (headers() block)
- `proxy.ts` (CSRF Origin check sur POST/PUT/DELETE/PATCH)
- `lib/platform/auth/tokens.ts` (TOKEN_ENCRYPTION_KEY rotation)
- `app/api/agents/[id]/route.ts` (mass assignment whitelist)
- `app/api/reports/[reportId]/export/route.ts` (CRLF Content-Disposition)
- `app/api/v2/runs/[id]/export/route.ts`, `app/api/v2/assets/[id]/download/route.ts`
- `proxy.ts:30-31` (STATIC_RE → restrict to /public/\*)
- `lib/embeddings/store.ts` (embedText cache hash)
- `stores/navigation.ts` (localStorage threads cleanup)
- `lib/browser/stagehand-executor.ts` (Anthropic apiKey explicit)

## Patterns à appliquer

### Pattern A — Security headers next.config.ts

```ts
// next.config.ts
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.sentry.io https://cloud.langfuse.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co https://*.sentry.io https://cloud.langfuse.com wss://*.supabase.co https://*.upstash.io",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(self), geolocation=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  // ... existing
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};
```

### Pattern B — CSRF Origin check (proxy.ts)

```ts
// proxy.ts (au début de la fonction proxy)
const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "DELETE", "PATCH"]);

function isCsrfSafe(req: NextRequest): boolean {
  if (!STATE_CHANGING_METHODS.has(req.method)) return true;

  // Bypass pour routes signées (webhooks externes, public reports)
  const path = req.nextUrl.pathname;
  if (path.startsWith("/api/webhooks/") || path.startsWith("/api/inngest")) return true;

  const origin = req.headers.get("origin");
  if (!origin) return false; // POST sans Origin → suspect

  const expected = process.env.NEXTAUTH_URL ?? "";
  try {
    return new URL(origin).origin === new URL(expected).origin;
  } catch {
    return false;
  }
}

// Dans proxy() :
if (!isCsrfSafe(req)) {
  return NextResponse.json({ error: "csrf_origin_mismatch" }, { status: 403 });
}
```

### Pattern C — TOKEN_ENCRYPTION_KEY rotation (keyId envelope)

```ts
// lib/platform/auth/tokens.ts (refactor)
const KEY_PROVIDERS: Record<string, () => Buffer> = {
  "1": () =>
    Buffer.from(
      process.env.TOKEN_ENCRYPTION_KEY_1 ?? process.env.TOKEN_ENCRYPTION_KEY ?? "",
      "hex",
    ),
  "2": () => Buffer.from(process.env.TOKEN_ENCRYPTION_KEY_2 ?? "", "hex"),
};

const ACTIVE_KEY_ID = process.env.TOKEN_ENCRYPTION_KEY_ACTIVE ?? "1";

export function encryptToken(plaintext: string): string {
  const keyId = ACTIVE_KEY_ID;
  const key = KEY_PROVIDERS[keyId]?.();
  if (!key || key.length !== 32) throw new Error("invalid_active_key");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: keyId.iv.tag.ciphertext (base64url)
  return `${keyId}.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptToken(encrypted: string): string {
  const [keyId, ivB64, tagB64, ctB64] = encrypted.split(".");
  if (!keyId || !ivB64 || !tagB64 || !ctB64) throw new Error("malformed_ciphertext");
  const key = KEY_PROVIDERS[keyId]?.();
  if (!key || key.length !== 32) throw new Error(`unknown_key_id_${keyId}`);
  const iv = Buffer.from(ivB64, "base64url");
  const tag = Buffer.from(tagB64, "base64url");
  const ct = Buffer.from(ctB64, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
```

### Pattern D — Mass assignment whitelist

```ts
// app/api/agents/[id]/route.ts PUT
const updatable = [
  "name",
  "description",
  "system_prompt",
  "temperature",
  "max_tokens",
  "top_p",
  "status",
  "metadata",
  "model_provider",
  "model_name",
];

const updateData: Partial<AgentUpdate> = {};
for (const key of updatable) {
  if (parsed.data[key] !== undefined) {
    updateData[key] = parsed.data[key];
  }
}
updateData.version = current.version + 1;
updateData.active_version_id = versionData?.id ?? current.active_version_id;

await sb.from("agents").update(updateData).eq("id", id).eq("tenant_id", scope.tenantId);
```

### Pattern E — CRLF Content-Disposition

```ts
function safeFilename(name: string): string {
  return String(name).replace(/[\r\n"\\]/g, "_").slice(0, 200);
}

// AVANT
"Content-Disposition": `attachment; filename="${result.fileName}"`,

// APRÈS
const safeName = safeFilename(result.fileName);
const encoded = encodeURIComponent(safeName);
"Content-Disposition": `attachment; filename="${safeName}"; filename*=UTF-8''${encoded}`,
```

### Pattern F — STATIC_RE restrict /public/\*

```ts
// proxy.ts
function isPublicStatic(path: string): boolean {
  if (path.startsWith("/_next/")) return true;
  if (path === "/favicon.ico") return true;
  if (path.startsWith("/public/")) return true;
  // Bundled assets only (pas user uploads)
  if (path.startsWith("/assets/bundled/")) return true;
  return false;
}
```

## Tests obligatoires

`__tests__/security/headers.test.ts`, `__tests__/security/csrf.test.ts`, `__tests__/security/token-rotation.test.ts`.

## Contraintes

- CSP doit pas casser Sentry / Langfuse / Supabase WebSocket — adapter `connect-src`
- HSTS preload : ne mettre QU'APRÈS validation manuelle (irréversible 6 mois)
- TOKEN rotation : nouvelles écritures avec keyId courant, anciennes lectures avec ancien key
- JAMAIS spread direct de body dans update (mass assignment)

## Rapport au orchestrateur

Format identique aux autres fixers.
