import { NextRequest, NextResponse } from "next/server";
import { saveTokens } from "@/lib/platform/auth/tokens";
import { registerProviderUsage } from "@/lib/connectors/control-plane/register";
import { aj } from "@/lib/security/arcjet";
import { withRoute, redactedError } from "@/lib/observability/logger";

const log = withRoute("GET /api/auth/callback/slack");

interface StatePayload {
  v: string; // codeVerifier
  u: string; // userId
  t?: string; // tenantId (optional, for multi-tenant)
  w?: string; // workspaceId (optional)
}

function parseState(raw: string | null): StatePayload | null {
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, "base64url").toString("utf-8"));
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  if (aj) {
    const decision = await aj.protect(request, { requested: 1 });
    if (decision.isDenied()) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }
  }
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");
  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:9000";

  if (error || !code) {
    log.error({ slackError: error, hasCode: Boolean(code) }, "callback_error_or_missing_code");
    return NextResponse.redirect(new URL("/apps?slack=error", appUrl));
  }

  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  const redirectUri = process.env.SLACK_REDIRECT_URI ?? `${appUrl}/api/auth/callback/slack`;

  if (!clientId || !clientSecret) {
    log.error({}, "missing_slack_client_credentials");
    return NextResponse.redirect(new URL("/apps?slack=error", appUrl));
  }

  const state = parseState(request.nextUrl.searchParams.get("state"));
  if (!state) {
    log.error({}, "missing_or_invalid_state");
    return NextResponse.redirect(new URL("/apps?slack=error", appUrl));
  }

  const { v: codeVerifier, u: userId, t: stateTenantId, w: stateWorkspaceId } = state;

  // Resolve scope from state or env (state carries scope for session-independent OAuth)
  const tenantId = stateTenantId ?? process.env.HEARST_TENANT_ID ?? "dev-tenant";
  const workspaceId = stateWorkspaceId ?? process.env.HEARST_WORKSPACE_ID ?? "dev-workspace";

  try {
    const body: Record<string, string> = {
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    };

    const tokenRes = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body),
    });

    const data = await tokenRes.json();

    if (!data.ok) {
      log.error({ slackError: data.error }, "token_exchange_failed");
      return NextResponse.redirect(new URL("/apps?slack=error", appUrl));
    }

    const userToken = data.authed_user?.access_token as string | undefined;
    const botToken = data.access_token as string | undefined;
    const token = userToken ?? botToken;

    if (!token) {
      log.error({}, "no_token_in_response");
      return NextResponse.redirect(new URL("/apps?slack=error", appUrl));
    }

    const teamId = data.team?.id as string | undefined;
    const refreshToken = (data.authed_user?.refresh_token ?? data.refresh_token ?? null) as string | null;
    const expiresIn = (data.authed_user?.expires_in ?? data.expires_in ?? 0) as number;

    await saveTokens(
      userId,
      {
        accessToken: token,
        refreshToken,
        expiresAt: expiresIn > 0 ? Date.now() + expiresIn * 1000 : 0,
      },
      "slack",
      { tenantId: teamId },
    );

    void registerProviderUsage({
      provider: "slack",
      scope: {
        tenantId: teamId ?? tenantId,
        workspaceId,
        userId,
      },
    });

    log.info(
      {
        userId,
        teamId,
        hasRefreshToken: refreshToken !== null,
        expiresAt: expiresIn > 0 ? Date.now() + expiresIn * 1000 : 0,
      },
      "slack_connected",
    );

    return NextResponse.redirect(new URL("/apps?slack=connected", appUrl));
  } catch (err) {
    log.error({ err: redactedError(err) }, "exchange_error");
    return NextResponse.redirect(new URL("/apps?slack=error", appUrl));
  }
}
