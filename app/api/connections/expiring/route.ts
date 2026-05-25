/**
 * GET /api/connections/expiring
 *
 * Retourne les connexions OAuth de l'utilisateur courant qui expirent
 * dans moins de AUTH_EXPIRING_DAYS_THRESHOLD jours.
 *
 * Consommé par useOAuthExpiry (TimelineRail badge dot, client-side).
 *
 * Format de réponse :
 *   { connections: ExpiringConnection[] }
 */

import { NextResponse } from "next/server";
import { checkExpiringTokens } from "@/lib/connections/oauth-refresh";
import { withScope } from "@/lib/platform/http/route-handler";

export const GET = withScope("GET /api/connections/expiring", async (_req, { scope }) => {
  const tenantId = scope.tenantId;

  try {
    const connections = await checkExpiringTokens({ userId: scope.userId, tenantId });
    return NextResponse.json({ connections });
  } catch (err) {
    console.error("[GET /api/connections/expiring] Erreur:", err);
    return NextResponse.json({ connections: [] });
  }
});
