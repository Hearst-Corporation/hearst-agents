/**
 * GET /api/v2/cockpit/signals
 *
 * Whisper ambient pour la PulseBar — signaux qualitatifs (mission failed,
 * OAuth expirée, brief stale, variant timeout, mission silencieuse).
 *
 * Voir lib/cockpit/ambient-signals.ts pour la logique d'agrégation et
 * fail-soft. Cache mémoire 60s côté serveur, refresh côté client toutes
 * les 60s également.
 */

import { NextResponse } from "next/server";
import { requireScope } from "@/lib/platform/auth/scope";
import { getAmbientSignals, type AmbientSignal } from "@/lib/cockpit/ambient-signals";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const { scope, error } = await requireScope({ context: "GET /api/v2/cockpit/signals" });
  if (error || !scope) {
    return NextResponse.json(
      { error: error?.message ?? "not_authenticated" },
      { status: error?.status ?? 401 },
    );
  }

  try {
    const signals: AmbientSignal[] = await getAmbientSignals(
      scope.userId,
      scope.tenantId,
      scope.workspaceId,
    );
    return NextResponse.json({ signals });
  } catch (err) {
    console.error("[GET /api/v2/cockpit/signals] uncaught", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
