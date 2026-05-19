/**
 * GET /api/composio/connections
 *
 * Returns the authenticated user's Composio-connected accounts.
 * Multi-tenant by design — Composio filters server-side on entityId = userId.
 */

import { NextResponse } from "next/server";
import {
  getComposio,
  getComposioInitError,
  isComposioConfigured,
  listConnections,
} from "@/lib/connectors/composio";
import { requireScope } from "@/lib/platform/auth/scope";

export async function GET() {
  const { scope, error } = await requireScope({ context: "GET /api/composio/connections" });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (!isComposioConfigured()) {
    return NextResponse.json(
      { ok: false, error: "composio_not_configured", message: "COMPOSIO_API_KEY not set" },
      { status: 503 },
    );
  }
  const client = await getComposio();
  if (!client) {
    const err = getComposioInitError();
    return NextResponse.json(
      {
        ok: false,
        error: err?.code ?? "composio_unavailable",
        message: err?.message ?? "Composio SDK could not be loaded",
      },
      { status: 503 },
    );
  }

  const connections = await listConnections(scope.userId);
  return NextResponse.json({ ok: true, connections });
}
