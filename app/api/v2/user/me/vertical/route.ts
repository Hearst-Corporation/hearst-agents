/**
 * GET /api/v2/user/me/vertical
 *
 * Retourne le vertical du tenant courant (pour client-side UI conditionnelle :
 * sidebar items, banners, etc.). Cache HTTP 5 min côté client+serveur (le
 * cache mémoire serveur a déjà 5 min côté getTenantIndustry).
 */

import { NextResponse } from "next/server";
import { requireScope } from "@/lib/platform/auth/scope";
import { safeErrorResponse } from "@/lib/platform/errors/safe-response";
import { getTenantIndustry } from "@/lib/verticals/hospitality";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { scope, error: scopeError } = await requireScope({
    context: "GET /api/v2/user/me/vertical",
  });
  if (scopeError || !scope) {
    return NextResponse.json(
      { error: scopeError?.message ?? "not_authenticated" },
      { status: scopeError?.status ?? 401 },
    );
  }

  try {
    const industry = await getTenantIndustry(scope.tenantId);
    return NextResponse.json(
      { industry },
      { headers: { "Cache-Control": "private, max-age=300" } },
    );
  } catch (err) {
    return safeErrorResponse(err, {
      route: "GET /api/v2/user/me/vertical",
      scope: { tenantId: scope.tenantId },
    });
  }
}
