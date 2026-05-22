/**
 * POST /api/v1/swarms/kickoff — Endpoint SDK pour lancer un swarm directement.
 *
 * Réplique la logique du tool natif `kickoff_swarm` (lib/tools/native/swarm.ts)
 * mais en endpoint REST autonome : crée la run tracée (startJobRun kind:"swarm")
 * puis enqueue le job Inngest "swarm-run" — retourne 202 immédiatement.
 *
 * Nom de swarm résolu via lib/swarms/registry (resolveSwarmName) — source unique.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import type { Json } from "@/lib/database.types";
import { startJobRun } from "@/lib/jobs/inngest/run-persistence";
import { enqueueJob } from "@/lib/jobs/queue";
import { requireServerSupabase } from "@/lib/platform/db/supabase";
import { hasApiScope, withApiAuth } from "@/lib/platform/http/api-auth";
import { resolveSwarmName } from "@/lib/swarms/registry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const kickoffBodySchema = z.object({
  swarmId: z.string().min(1, "swarmId ne peut pas être vide"),
  context: z.record(z.string(), z.unknown()).optional(),
});

export const POST = withApiAuth("POST /api/v1/swarms/kickoff", async (req, { tenant }) => {
  if (!hasApiScope(tenant, "write")) {
    return NextResponse.json({ error: "insufficient_scope" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = kickoffBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { swarmId, context } = parsed.data;

  const sb = requireServerSupabase();
  if (!sb) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  let runId: string | null = null;

  try {
    runId = await startJobRun(sb, {
      kind: "swarm",
      userId: tenant.userId,
      tenantId: tenant.tenantId,
      input: { swarmId, context: context ?? {} } as unknown as Json,
      eventId: `swarm-${Date.now()}`,
    });
  } catch (err) {
    console.error("[v1/swarms/kickoff] startJobRun failed:", err instanceof Error ? err.name : err);
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  if (!runId) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 });
  }

  try {
    await enqueueJob({
      jobKind: "swarm-run",
      userId: tenant.userId ?? tenant.tenantId,
      tenantId: tenant.tenantId,
      workspaceId: "", // pas de workspace en contexte clé API (ApiAuthTenant ne l'expose pas)
      estimatedCostUsd: 0,
      swarmId,
      swarmName: resolveSwarmName(swarmId),
      context: context ?? {},
      runId,
    });
  } catch (err) {
    console.error("[v1/swarms/kickoff] enqueueJob failed:", err instanceof Error ? err.name : err);
    // Run créée mais job non enqueued — retourner quand même le runId avec avertissement
    return NextResponse.json(
      { runId, swarmName: resolveSwarmName(swarmId), status: "enqueue_failed" },
      { status: 202 },
    );
  }

  return NextResponse.json(
    { runId, swarmName: resolveSwarmName(swarmId), status: "running" },
    { status: 202 },
  );
});
