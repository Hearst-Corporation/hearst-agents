import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getUserId } from "@/lib/platform/auth/get-user-id";
import { requireScope } from "@/lib/platform/auth/scope";
import { signOAuthState } from "@/lib/platform/auth/signed-state";
import { aj } from "@/lib/security/arcjet";

function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

export async function GET(req: NextRequest) {
  if (aj) {
    const decision = await aj.protect(req, { requested: 1 });
    if (decision.isDenied()) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }
  }
  const { scope, error } = await requireScope({ context: "GET /api/auth/slack" });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const { userId, tenantId, workspaceId } = scope;

  const clientId = process.env.SLACK_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "SLACK_CLIENT_ID not configured" }, { status: 500 });
  }

  const userScopes = [
    "channels:read",
    "channels:history",
    "im:read",
    "im:history",
    "users:read",
    "groups:read",
    "groups:history",
    "mpim:read",
    "mpim:history",
  ].join(",");

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:4102";
  const redirectUri = process.env.SLACK_REDIRECT_URI ?? `${baseUrl}/api/auth/callback/slack`;

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  const url = new URL("https://slack.com/oauth/v2/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("user_scope", userScopes);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");

  // Encode verifier + userId + scope dans le `state` OAuth signé HMAC-SHA256.
  // La signature lie le payload au NEXTAUTH_SECRET serveur : un attaquant ne peut
  // pas forger un state valide (F-006). Cookies non utilisés car ils ne survivent
  // pas aux redirects cross-domain (localhost → ngrok).
  const statePayload = signOAuthState({ v: codeVerifier, u: userId, t: tenantId, w: workspaceId });

  url.searchParams.set("state", statePayload);

  return new Response(null, {
    status: 302,
    headers: { Location: url.toString() },
  });
}
