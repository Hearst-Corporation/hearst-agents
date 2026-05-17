/**
 * GET  /api/v2/settings/flags — get feature flags for current scope
 * POST /api/v2/settings/flags — toggle a feature flag (admin only)
 */

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { redactedError, withRoute } from "@/lib/observability/logger";
import { requireScope } from "@/lib/platform/auth/scope";
import { requireServerSupabase } from "@/lib/platform/db/supabase";
import { parseJsonBody } from "@/lib/platform/http/parse-body";
import { getCategorySettings, getFeatureFlag, setFeatureFlag } from "@/lib/platform/settings";

const log = withRoute("GET|POST /api/v2/settings/flags");

const flagsBodySchema = z
  .object({
    key: z.string().min(1).max(200),
    enabled: z.boolean(),
  })
  .strict();

export const dynamic = "force-dynamic";

export async function GET() {
  const { scope, error } = await requireScope({ context: "GET /api/v2/settings/flags" });
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });

  const db = requireServerSupabase();
  try {
    const flags = await getCategorySettings(db, "feature_flags", scope.tenantId);
    return NextResponse.json({ flags });
  } catch (e) {
    log.error({ err: redactedError(e) }, "flags_get_failed");
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { scope, error } = await requireScope({ context: "POST /api/v2/settings/flags" });
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });

  const db = requireServerSupabase();

  try {
    const parsed = await parseJsonBody(req, flagsBodySchema);
    if (!parsed.ok) return parsed.response;

    const { key, enabled } = parsed.data;
    await setFeatureFlag(db, key, enabled, scope.userId);
    const current = await getFeatureFlag(db, key, scope.tenantId);
    return NextResponse.json({ key, enabled: current });
  } catch (e) {
    log.error({ err: redactedError(e) }, "flags_post_failed");
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
