/**
 * GET /api/composio/apps
 *
 * Returns the full Composio app catalog (cached 30 min process-wide).
 * Used by the apps page to render the by-category grid.
 */

import { NextResponse } from "next/server";
import {
  getComposio,
  getComposioInitError,
  isComposioConfigured,
  listAvailableApps,
} from "@/lib/connectors/composio";
import { requireScope } from "@/lib/platform/auth/scope";

export async function GET() {
  const { scope, error } = await requireScope({ context: "GET /api/composio/apps" });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (!isComposioConfigured()) {
    return NextResponse.json(
      { ok: false, error: "composio_not_configured", message: "COMPOSIO_API_KEY not set" },
      { status: 503 },
    );
  }
  // Force-init so we surface SDK errors as 503 instead of an empty list.
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
  let apps;
  try {
    apps = await listAvailableApps();
  } catch (err) {
    return NextResponse.json(
      { error: "service_unavailable", detail: err instanceof Error ? err.message : "unknown" },
      { status: 503 },
    );
  }
  return NextResponse.json({ ok: true, apps });
}
