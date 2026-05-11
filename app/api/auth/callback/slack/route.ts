import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/platform/auth/options";
import { verifyOAuthState } from "@/lib/platform/auth/signed-state";
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

  // Vérification HMAC du state (F-006) : rejette tout state non signé ou falsifié.
  const rawState = request.nextUrl.searchParams.get("state");
  const state = verifyOAuthState<StatePayload>(rawState);
  if (!state) {
    log.error({ hasRawState: rawState !== null }, "missing_or_invalid_state_hmac");
    return NextResponse.redirect(new URL("/apps?slack_error=state_invalid", appUrl));
  }

  const { v: codeVerifier, u: userId, t: stateTenantId, w: stateWorkspaceId } = state;

  // Cross-check : le userId dans le state signé DOIT matcher la session actuelle.
  // Empêche un attaquant de capturer le state d'une victime et de le rejouer sur sa propre session.
  const currentSession = await getServerSession(authOptions);
  const sessionUserId =
    (currentSession?.user as { id?: string } | undefined)?.id ??
    (currentSession as unknown as Record<string, unknown> | null)?.userId as string | undefined ??
    undefined;
  if (!sessionUserId || sessionUserId !== userId) {
    log.warn(
      {
        stateUserId: userId.slice(0, 8),
        sessionUserId: sessionUserId?.slice(0, 8) ?? "none",
      },
      "slack_callback_user_mismatch",
    );
    return NextResponse.redirect(new URL("/apps?slack_error=user_mismatch", appUrl));
  }

  // Resolve scope from state (state carries scope encoded at OAuth init by the user session).
  // Fail-closed : si le state ne porte pas de tenantId, le token est mal formé.
  const tenantId = stateTenantId ?? "";
  const workspaceId = stateWorkspaceId ?? "";
  if (!tenantId || !workspaceId) {
    log.error({ stateTenantId, stateWorkspaceId }, "missing_tenant_in_state");
    return NextResponse.redirect(new URL("/apps?slack=error", appUrl));
  }

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
