/**
 * POST /api/composio/invalidate-cache
 *
 * Wipes the in-process Composio tool-discovery cache for the authenticated
 * user. Called by the frontend when the user returns from an OAuth flow
 * (URL contains `?connected=<app>`) so that the next `getToolsForUser()`
 * fetches a fresh tool list including the just-authorised app.
 */

import { NextResponse } from "next/server";
import { invalidateUserDiscovery } from "@/lib/connectors/composio/discovery";
import { withScope } from "@/lib/platform/http/route-handler";

export const POST = withScope("POST /api/composio/invalidate-cache", async (_req, { scope }) => {
  invalidateUserDiscovery(scope.userId);
  return NextResponse.json({ ok: true });
});
