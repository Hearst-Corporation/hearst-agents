import { type NextRequest, NextResponse } from "next/server";
import { isDevBypassEnabled } from "@/lib/platform/auth/dev-bypass";
import { aj } from "@/lib/security/arcjet";

/**
 * GET /api/auth/dev-login
 *
 * Auto-login pour Electron en mode dev (HEARST_DEV_AUTH_BYPASS=1).
 * Retourne une page HTML minimaliste qui :
 *   1. Récupère le csrfToken de NextAuth
 *   2. POST les credentials au callback
 *   3. Redirige vers / une fois la session créée
 *
 * Désactivé en prod : isDevBypassEnabled() throw au boot si bypass=1 + NODE_ENV=production.
 */
export async function GET(req: NextRequest) {
  if (aj) {
    const decision = await aj.protect(req, { requested: 1 });
    if (decision.isDenied()) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }
  }
  if (!isDevBypassEnabled()) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>body{background:#000;color:#4A8B86;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}</style>
</head><body>
<div>Connexion dev en cours…</div>
<script>
(async () => {
  try {
    const csrf = await fetch('/api/auth/csrf').then(r => r.json());
    await fetch('/api/auth/callback/dev-bypass', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ csrfToken: csrf.csrfToken, callbackUrl: '/', json: 'true' })
    });
    window.location.href = '/';
  } catch(e) {
    document.body.textContent = 'Erreur login: ' + e.message;
  }
})();
</script>
</body></html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
