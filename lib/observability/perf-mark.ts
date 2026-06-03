/**
 * perf-mark.ts — Instrumentation latence du chemin orchestrate (temporaire/diagnostic).
 *
 * Objectif (plan flotte step 0) : localiser les ~3,3 s perdus entre la génération
 * du 1er token LLM (interne) et sa réception client. On pose des marks aux bornes
 * clés du flow, corrélées par run_id, et on logge en 1 ligne JSON parsable :
 *
 *   [PERF-MARK] {"runId":"…","stage":"llm_first_token","tEpochMs":…}
 *
 * Activation : env PERF_MARKS=1 (no-op sinon → zéro coût en prod normale).
 * Lecture : grep "PERF-MARK" sur les logs, ou _perf-local/measure.mjs (corrélation
 * client↔serveur). À retirer une fois le goulot localisé et corrigé.
 */

const ENABLED = process.env.PERF_MARKS === "1";

export function perfMark(runId: string, stage: string): void {
  if (!ENABLED) return;
  // Date.now() est tolérable ici (diagnostic), on veut un epoch comparable
  // entre process Helm et le client measure.mjs.
  console.log(`[PERF-MARK] ${JSON.stringify({ runId, stage, tEpochMs: Date.now() })}`);
}
