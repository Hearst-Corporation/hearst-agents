/**
 * GET  /api/admin/settings — list settings (RBAC: read settings)
 * POST /api/admin/settings — upsert setting (RBAC: update settings)
 */

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSystemSettings, type SettingCategory, upsertSystemSetting } from "@/lib/admin/settings";
import { redactedError, withRoute } from "@/lib/observability/logger";
import { isError, requireAdmin } from "../_helpers";

const adminSettingsBodySchema = z
  .object({
    key: z.string().min(1).max(200),
    value: z.unknown(),
    category: z.enum(["feature_flags", "thresholds", "limits", "integrations", "ui", "analytics"]),
    description: z.string().max(1000).optional(),
    isEncrypted: z.boolean().optional(),
    tenantId: z.string().uuid().nullable().optional(),
  })
  .strict();

export const dynamic = "force-dynamic";

const logGet = withRoute("GET /api/admin/settings");
const logPost = withRoute("POST /api/admin/settings");

export async function GET(req: NextRequest) {
  const guard = await requireAdmin("GET /api/admin/settings", {
    resource: "settings",
    action: "read",
  });
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
  const guard = await requireAdmin("POST /api/admin/settings", {
    resource: "settings",
    action: "update",
  });
  if (isError(guard)) return guard;

  const { scope, db } = guard;

  try {
    const raw = await req.json().catch(() => null);
    const parsed = adminSettingsBodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { key, value, category, description, isEncrypted, tenantId } = parsed.data;

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
