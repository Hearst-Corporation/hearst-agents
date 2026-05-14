/**
 * GET  /api/v2/settings/preferences — get user preferences
 * POST /api/v2/settings/preferences — update a user preference
 */

import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { requireScope } from "@/lib/platform/auth/scope";
import { requireServerSupabase } from "@/lib/platform/db/supabase";
import {
  getUserPreference,
  setUserPreference,
  getUserLocale,
  getUserNotificationPrefs,
  type SettingValue,
} from "@/lib/platform/settings";

const preferencesBodySchema = z.object({
  key: z.string().min(1).max(200),
  value: z.unknown(),
}).strict();

export const dynamic = "force-dynamic";

export async function GET() {
  const { scope, error } = await requireScope({ context: "GET /api/v2/settings/preferences" });
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });

  const db = requireServerSupabase();

  try {
    const [locale, notifications] = await Promise.all([
      getUserLocale(db, scope.userId),
      getUserNotificationPrefs(db, scope.userId),
    ]);

    return NextResponse.json({
      preferences: { locale, notifications },
    });
  } catch (e) {
    console.error("[Settings API] GET /preferences error:", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { scope, error } = await requireScope({ context: "POST /api/v2/settings/preferences" });
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });

  const db = requireServerSupabase();

  try {
    const raw = await req.json().catch(() => null);
    const parsed = preferencesBodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { key, value } = parsed.data;
    // value est unknown (Zod) — le store accepte SettingValue (string|number|boolean|object).
    // On rejette les cas non-supportés avant d'appeler.
    if (value === null || value === undefined || typeof value === "function" || typeof value === "symbol" || typeof value === "bigint") {
      return NextResponse.json({ error: "invalid_value_type" }, { status: 400 });
    }
    await setUserPreference(db, scope.userId, key, value as SettingValue);
    const current = await getUserPreference(db, scope.userId, key, value as SettingValue);
    return NextResponse.json({ key, value: current });
  } catch (e) {
    console.error("[Settings API] POST /preferences error:", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
