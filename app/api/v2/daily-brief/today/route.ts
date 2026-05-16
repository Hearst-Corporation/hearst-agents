/**
 * GET /api/v2/daily-brief/today?date=YYYY-MM-DD
 *
 * Retourne le Daily Brief du jour (ou de la date demandée) si déjà généré.
 * - 200 + { brief: PersistedDailyBrief } si trouvé
 * - 200 + { brief: null } si aucun brief pour cette date (l'UI pourra
 *   proposer le bouton "Générer maintenant")
 *
 * Pas de génération côté GET — on reste read-only ici. La génération passe
 * par POST /generate.
 */

import { NextResponse } from "next/server";
import { loadDailyBriefForDate } from "@/lib/daily-brief/store";
import { withScope } from "@/lib/platform/http/route-handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = withScope("GET /api/v2/daily-brief/today", async (req, { scope }) => {
  const url = new URL(req.url);
  const dateParam = url.searchParams.get("date");
  const targetDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : undefined;

  const brief = await loadDailyBriefForDate({
    userId: scope.userId,
    targetDate,
  });

  return NextResponse.json({ brief });
});
