/**
 * POST /api/v2/browser/start — Crée une session Browserbase live et lance
 * Stagehand sur la `task` reçue (Phase B4 — branchement complet).
 *
 * Signature 3 — Co-Browsing : la BrowserStage appelle cette route pour
 * obtenir un sessionId + connectUrl + debugViewerUrl. Le debugViewerUrl est
 * affiché dans une iframe pour que l'utilisateur voie le browser en direct
 * et reprenne la main via Take Over.
 *
 * Comportement :
 *   - `task` requis → la session est créée, et Stagehand est lancé
 *     fire-and-forget côté serveur sur cette task. Le frontend reçoit le
 *     sessionId immédiatement et observe les `browser_action` events via
 *     SSE (events-stream global).
 *   - Stagehand utilise `runBrowserTask` (lib/browser/stagehand-executor),
 *     qui s'enregistre dans `activeRuns` pour que POST /[id]/take-over
 *     puisse l'interrompre.
 *
 * Avant Phase B4 : la route ne loggait que `task` puis le frontend chaînait
 * un POST /[id]/execute pour le lancer (2 round-trips, fragilité). Désormais
 * tout le flow est atomique côté serveur.
 */

import { randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runBrowserTask } from "@/lib/browser/stagehand-executor";
import { createSession } from "@/lib/capabilities/providers/browserbase";
import { requireScope } from "@/lib/platform/auth/scope";
import { requireServerSupabase } from "@/lib/platform/db/supabase";

const browserStartBodySchema = z
  .object({
    task: z.string().min(1).max(10_000),
    startUrl: z.string().url().max(2048).optional(),
    maxActions: z.number().int().min(1).max(100).optional(),
  })
  .strict();

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { scope, error } = await requireScope({ context: "POST /api/v2/browser/start" });
  if (error || !scope) {
    return NextResponse.json(
      { error: error?.message ?? "not_authenticated" },
      { status: error?.status ?? 401 },
    );
  }

  const raw = await req.json().catch(() => null);
  const parsed = browserStartBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const body = parsed.data;
  const task = body.task.trim();

  let session: Awaited<ReturnType<typeof createSession>>;
  try {
    session = await createSession();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[BrowserStart] createSession failed:", message);
    return NextResponse.json({ error: "session_create_failed", message }, { status: 502 });
  }

  // Tracker la session dans browser_sessions pour le ownership check (F-005)
  try {
    const sb = requireServerSupabase();
    await sb.from("browser_sessions").insert({
      session_id: session.sessionId,
      user_id: scope.userId,
      tenant_id: scope.tenantId,
    });
  } catch (err) {
    // Non-bloquant : la session Browserbase existe côté fournisseur, on
    // continue sans ownership tracking plutôt que d'abandonner la session.
    console.error("[BrowserStart] browser_sessions insert failed:", err);
  }

  // Lance Stagehand en fire-and-forget. Les actions sont émises sur le bus
  // global (browser_action / browser_task_completed / browser_task_failed)
  // et consommées via SSE par la BrowserStage côté client. Pas d'await :
  // le client reçoit le sessionId immédiatement et observe la progression.
  const taskId = randomUUID();
  void (async () => {
    try {
      await runBrowserTask({
        sessionId: session.sessionId,
        task,
        runId: taskId,
        maxActions: body.maxActions,
        tenantId: scope.tenantId,
      });
    } catch (err) {
      console.error("[BrowserStart] runBrowserTask failed:", err);
    }
  })();

  return NextResponse.json({
    sessionId: session.sessionId,
    connectUrl: session.connectUrl,
    debugViewerUrl: session.debugViewerUrl,
    taskId,
  });
}
