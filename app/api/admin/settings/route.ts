/**
 * GET  /api/admin/settings — list settings (RBAC: read settings)
 * POST /api/admin/settings — upsert setting (RBAC: update settings)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isError } from "../_helpers";
import {
  getSystemSettings,
  upsertSystemSetting,
  type SettingCategory,
} from "@/lib/admin/settings";
import { redactedError, withRoute } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";

const logGet = withRoute("GET /api/admin/settings");
const logPost = withRoute("POST /api/admin/settings");

export async function GET(req: NextRequest) {
  const guard = await requireAdmin("GET /api/admin/settings", { resource: "settings", action: "read" });
  if (isError(guard)) return guard;

  const { db } = guard;
  const url = new URL(req.url);
  const category = url.searchParams.get("category") as SettingCategory | undefined;
  const tenantId = url.searchParams.get("tenantId") ?? undefined;

  try {
    const settings = await getSystemSettings(db, {
      category: category || undefined,
      tenantId,
      includeGlobal: !!tenantId,
    });
    return NextResponse.json({ settings });
  } catch (e) {
    logGet.error({ err: redactedError(e), category, tenantId }, "list_failed");
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin("POST /api/admin/settings", { resource: "settings", action: "update" });
  if (isError(guard)) return guard;

  const { scope, db } = guard;

  try {
    const body = await req.json();
    const { key, value, category, description, isEncrypted, tenantId } = body;

    if (!key || !category) {
      return NextResponse.json({ error: "key and category are required" }, { status: 400 });
    }

    const setting = await upsertSystemSetting(db, {
      key,
      value,
      category,
      description,
      isEncrypted,
      tenantId: tenantId ?? null,
      updatedBy: scope.userId,
    });

    return NextResponse.json({ setting });
  } catch (e) {
    logPost.error({ err: redactedError(e) }, "upsert_failed");
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
