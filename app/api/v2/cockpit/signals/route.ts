/**
 * GET /api/v2/cockpit/signals
 *
 * Whisper ambient pour la PulseBar — signaux qualitatifs (mission failed,
 * OAuth expirée, brief stale, variant timeout, mission silencieuse).
 *
 * Param query `?range=1h|7d|30d|all` (default `1h` pour la PulseBar).
 * Le SignalBoardStage (Q3-B) utilise `7d` pour une vue timeline étendue.
 *
 * Voir lib/cockpit/ambient-signals.ts pour la logique d'agrégation et
 * fail-soft. Cache mémoire 60s côté serveur, refresh côté client toutes
 * les 60s également.
 */

import { type NextRequest, NextResponse } from "next/server";
import {
  type AmbientSignal,
  type AmbientSignalsRange,
  getAmbientSignals,
} from "@/lib/cockpit/ambient-signals";
import { requireScope } from "@/lib/platform/auth/scope";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_RANGES: AmbientSignalsRange[] = ["1h", "7d", "30d", "all"];

function parseRange(value: string | null): AmbientSignalsRange {
  if (!value) return "1h";
  return (ALLOWED_RANGES as string[]).includes(value) ? (value as AmbientSignalsRange) : "1h";
}

export async function GET(req: NextRequest) {
  const { scope, error } = await requireScope({ context: "GET /api/v2/cockpit/signals" });
  if (error || !scope) {
    return NextResponse.json(
      { error: error?.message ?? "not_authenticated" },
      { status: error?.status ?? 401 },
    );
  }

  const range = parseRange(req.nextUrl.searchParams.get("range"));

  try {
    const signals: AmbientSignal[] = await getAmbientSignals(
      scope.userId,
      scope.tenantId,
      scope.workspaceId,
      range,
    );
    return NextResponse.json({ signals, range });
  } catch (err) {
    console.error("[GET /api/v2/cockpit/signals] uncaught", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
