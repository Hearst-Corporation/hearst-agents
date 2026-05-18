/**
 * Cron reaper — runs zombies + asset_variants bloqués (P0-2).
 *
 * lib/jobs/inngest/run-persistence.ts insère runs.status='running'. Si le
 * process meurt entre startJobRun et endJobRun, la row reste 'running'
 * éternellement → /admin/analytics agrège des coûts faux. Idem pour
 * asset_variants bloqués en 'generating' si le worker meurt.
 *
 * Ce cron (Vercel Cron, toutes les 5 min — cf. vercel.json) marque comme
 * 'failed' toute run / variant zombie. P2 — le cutoff est calculé PAR
 * run_kind : un run `chat` zombie (~secondes attendues) est reapé en
 * quelques minutes au lieu d'attendre 2h10 (l'ancien cutoff global =
 * max(maxDurationMs) + 10min, dominé par meeting-bot à 2h). Chaque kind
 * a son propre cutoff = (sa durée attendue) + marge 10 min ; on émet une
 * requête UPDATE par kind présent. Les variants gardent un cutoff global
 * conservateur (pas de kind exploitable sur asset_variants).
 *
 * Auth : header `Authorization: Bearer ${CRON_SECRET}`. Vercel Cron envoie
 * ce header automatiquement si CRON_SECRET est défini en env. Pas de
 * CRON_SECRET ou header non concordant → 401.
 *
 * Fail-soft : toute erreur Supabase est loggée mais ne fait pas planter le
 * cron (retourne 200 avec compteurs partiels).
 */

import { NextResponse } from "next/server";
import type { Database } from "@/lib/database.types";
import { JOB_QUEUE_CONFIGS } from "@/lib/jobs/configs";
import { getServerSupabase } from "@/lib/platform/db/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Sous backlog (beaucoup de kinds → N updates), éviter la troncature de la
// fonction serverless Vercel (défaut 10s sur Hobby/15s). 60s = marge large
// pour des UPDATE indexés (idx_runs_running_started, migration 0089).
export const maxDuration = 60;

const STALE_MARGIN_MS = 10 * 60 * 1000;

type RunKind = Database["public"]["Enums"]["run_kind"];

/**
 * Durée attendue (ms) par run_kind, AVANT marge. Les kinds media reprennent
 * le maxDurationMs de leur queue BullMQ (source de vérité unique). Les kinds
 * LLM (chat/workflow/evaluation/tool_test) n'ont pas de JobKind ni de queue
 * dédiée : on leur applique un plancher de 5 min, généreux pour un run LLM
 * (même un workflow multi-step termine bien avant) mais 26× plus serré que
 * l'ancien cutoff global de 2h10.
 */
const LLM_RUN_MAX_MS = 5 * 60 * 1000;
const RUN_KIND_MAX_DURATION_MS: Record<RunKind, number> = {
  chat: LLM_RUN_MAX_MS,
  workflow: LLM_RUN_MAX_MS,
  evaluation: LLM_RUN_MAX_MS,
  tool_test: LLM_RUN_MAX_MS,
  audio_gen: JOB_QUEUE_CONFIGS["audio-gen"].maxDurationMs,
  image_gen: JOB_QUEUE_CONFIGS["image-gen"].maxDurationMs,
  video_gen: JOB_QUEUE_CONFIGS["video-gen"].maxDurationMs,
  doc_parse: JOB_QUEUE_CONFIGS["document-parse"].maxDurationMs,
  code_exec: JOB_QUEUE_CONFIGS["code-exec"].maxDurationMs,
};

/** Cutoff variants : pas de kind exploitable → on garde un global prudent. */
const VARIANT_STALE_CUTOFF_MS =
  Math.max(...Object.values(JOB_QUEUE_CONFIGS).map((c) => c.maxDurationMs)) + STALE_MARGIN_MS;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sb = getServerSupabase();
  if (!sb) {
    // Fail-soft : pas de DB configurée → rien à reaper, mais on ne plante pas.
    return NextResponse.json({ reaped_runs: 0, reaped_variants: 0 });
  }

  const now = Date.now();
  let reapedRuns = 0;
  let reapedVariants = 0;

  // ── 1. Runs zombies : status='running' trop vieilles, PAR run_kind ──
  // Une requête UPDATE par kind, chacune avec son propre cutoff =
  // durée attendue du kind + marge. Fail-soft : l'échec d'un kind
  // n'empêche pas les autres ni la réponse 200.
  for (const [kind, maxMs] of Object.entries(RUN_KIND_MAX_DURATION_MS) as [RunKind, number][]) {
    const cutoffIso = new Date(now - (maxMs + STALE_MARGIN_MS)).toISOString();
    try {
      const { data, error } = await sb
        .from("runs")
        .update({
          status: "failed",
          error: "reaped: stale running run",
          finished_at: new Date().toISOString(),
        })
        .eq("status", "running")
        .eq("kind", kind)
        .lt("started_at", cutoffIso)
        .select("id");

      if (error) {
        console.error(`[reap-stale-runs] runs update failed (kind=${kind}):`, error.message);
      } else {
        reapedRuns += data?.length ?? 0;
      }
    } catch (err) {
      console.error(`[reap-stale-runs] runs reap threw (kind=${kind}):`, err);
    }
  }

  // ── 2. asset_variants bloqués en 'generating' ─────────────────────
  const variantCutoffIso = new Date(now - VARIANT_STALE_CUTOFF_MS).toISOString();
  try {
    const { data, error } = await sb
      .from("asset_variants")
      .update({
        status: "failed",
        error: "reaped: stale generating variant",
      })
      .eq("status", "generating")
      .lt("created_at", variantCutoffIso)
      .select("id");

    if (error) {
      console.error("[reap-stale-runs] asset_variants update failed:", error.message);
    } else {
      reapedVariants = data?.length ?? 0;
    }
  } catch (err) {
    console.error("[reap-stale-runs] asset_variants reap threw:", err);
  }

  return NextResponse.json({ reaped_runs: reapedRuns, reaped_variants: reapedVariants });
}
