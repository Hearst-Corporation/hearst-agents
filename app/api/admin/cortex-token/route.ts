/**
 * POST /api/admin/cortex-token
 *
 * Génère un JWT Cortex pour un tenant arbitraire.
 * Réservé aux admins (via requireAdmin).
 * Utilisé par la page /admin/switch-tenant pour debug multi-tenant.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { signCortexToken } from "@/lib/auth/cortex-jwt";
import { getHearstSession } from "@/lib/platform/auth";
import { isError, requireAdmin } from "../_helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  tenant_id: z.string().min(1).max(64),
  ttl_seconds: z.number().int().positive().max(86400).optional(),
});

export async function POST(req: NextRequest) {
  const guard = await requireAdmin("cortex-token", {
    resource: "admin",
    action: "admin",
  });
  if (isError(guard)) return guard;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Récupère l'email depuis la session pour le mapping admin/non-admin
  const session = await getHearstSession();
  const callerEmail = session?.user?.email ?? undefined;

  // Le caller est admin Helm → on signe avec le tenant demandé + scope admin
  const token = await signCortexToken({
    user_id: guard.scope.userId ?? "admin",
    email: callerEmail,
    tenant_id: parsed.data.tenant_id,
    ttl_seconds: parsed.data.ttl_seconds,
  });

  if (!token) {
    return NextResponse.json({ error: "cortex_jwt_not_configured" }, { status: 503 });
  }

  return NextResponse.json({
    token,
    tenant_id: parsed.data.tenant_id,
    expires_in: parsed.data.ttl_seconds ?? 900,
  });
}
