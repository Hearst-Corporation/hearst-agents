/**
 * Missions API — Create and list scheduled missions.
 * Uses the canonical v2 mission layer (lib/engine/runtime/missions + state/adapter).
 */

import { NextRequest, NextResponse } from "next/server";
import { createScheduledMission } from "@/lib/engine/runtime/missions/create-mission";
import { addMission, disableMission, getMission } from "@/lib/engine/runtime/missions/store";
import {
  saveScheduledMission,
  getScheduledMissions,
  updateScheduledMission,
} from "@/lib/engine/runtime/state/adapter";
import { requireScope } from "@/lib/platform/auth/scope";
import { validateGraph } from "@/lib/workflows/validate";
import type { WorkflowGraph } from "@/lib/workflows/types";
import { createMissionSchema, toggleMissionSchema } from "@/lib/contracts/missions";

export const dynamic = "force-dynamic";

export async function GET() {
  // Resolve scope with dev fallback allowed
  const { scope, error } = await requireScope({ context: "GET /api/v2/missions" });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  try {
    // Get missions scoped to current user/tenant/workspace
    const missions = await getScheduledMissions({
      userId: scope.userId,
      tenantId: scope.tenantId,
      workspaceId: scope.workspaceId,
    });

    return NextResponse.json({ missions });
  } catch (e) {
    console.error("GET /api/v2/missions: uncaught", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Resolve scope with dev fallback allowed
  const { scope, error } = await requireScope({ context: "POST /api/v2/missions" });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = createMissionSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Mutable copy : la route dérive `schedule`/`input` à partir du graphe
  // C3 si manquants (cf logique legacy ci-dessous).
  const body: {
    name?: string;
    input?: string;
    schedule?: string;
    enabled?: boolean;
    workflowGraph?: WorkflowGraph;
    approvers?: string[];
    approvalMode?: "all" | "any" | "majority";
  } = {
    ...parsed.data,
    workflowGraph: parsed.data.workflowGraph as WorkflowGraph | undefined,
  };

  // Cas Builder C3 : si workflowGraph fourni, input/schedule peuvent être
  // dérivés du graphe (cron du trigger, name fourni). Sinon comportement
  // legacy (input + schedule obligatoires).
  if (body.workflowGraph) {
    const validation = validateGraph(body.workflowGraph);
    if (!validation.valid) {
      return NextResponse.json(
        { error: "invalid_workflow_graph", details: validation.errors },
        { status: 400 },
      );
    }
    if (!body.schedule) {
      const start = body.workflowGraph.nodes.find(
        (n) => n.id === body.workflowGraph!.startNodeId,
      );
      const cron = (start?.config?.cron as string | undefined) ?? "manual";
      body.schedule = cron;
    }
    if (!body.input) {
      body.input = body.name ?? "Workflow personnalisé";
    }
  }

  if (!body.input || !body.schedule) {
    return NextResponse.json(
      { error: "input_and_schedule_required" },
      { status: 400 },
    );
  }

  const name = body.name || body.input.slice(0, 80);

  // Check for duplicates within user's scope
  const existingMissions = await getScheduledMissions({
    userId: scope.userId,
    tenantId: scope.tenantId,
    workspaceId: scope.workspaceId,
  });

  const duplicateMission = existingMissions.find(
    (mission) =>
      mission.name === name &&
      mission.input === body.input &&
      mission.schedule === body.schedule,
  );

  if (duplicateMission) {
    console.warn(
      `[MissionsAPI] Duplicate mission prevented: ${duplicateMission.id} — ${duplicateMission.schedule}`,
    );
    return NextResponse.json({ mission: duplicateMission, duplicate: true }, { status: 200 });
  }

  const mission = createScheduledMission({
    name,
    input: body.input,
    schedule: body.schedule,
    tenantId: scope.tenantId,
    workspaceId: scope.workspaceId,
    userId: scope.userId,
    workflowGraph: body.workflowGraph,
  });

  if (body.enabled === false) {
    (mission as { enabled: boolean }).enabled = false;
  }

  // Q3-D — approbation collaborative
  if (body.approvers && body.approvers.length > 0) {
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const valid = body.approvers.every((e) => typeof e === "string" && emailRe.test(e));
    if (!valid) {
      return NextResponse.json({ error: "invalid_approver_email" }, { status: 400 });
    }
    (mission as { approvers?: string[] }).approvers = body.approvers;
    (mission as { approvalMode?: "all" | "any" | "majority" }).approvalMode =
      body.approvalMode ?? "all";
  }

  addMission(mission);

  const persisted = await saveScheduledMission({
    id: mission.id,
    tenantId: mission.tenantId,
    workspaceId: mission.workspaceId,
    userId: mission.userId,
    name: mission.name,
    input: mission.input,
    schedule: mission.schedule,
    enabled: mission.enabled,
    createdAt: mission.createdAt,
    workflowGraph: body.workflowGraph,
    approvers: mission.approvers,
    approvalMode: mission.approvalMode,
  });

  if (!persisted) {
    console.warn("[MissionsAPI] Mission saved in-memory only — Supabase unavailable");
  }

  console.log(`[MissionsAPI] Mission created: ${mission.id} — ${mission.schedule} (user: ${scope.userId.slice(0, 8)})`);

  return NextResponse.json({ mission }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  // Resolve scope with dev fallback allowed
  const { scope, error } = await requireScope({ context: "PATCH /api/v2/missions" });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = toggleMissionSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const body = parsed.data;

  // Verify ownership before updating
  const mem = getMission(body.id);
  if (mem && mem.userId && mem.userId !== scope.userId) {
    console.warn(`[MissionsAPI] Access denied — user mismatch for mission ${body.id}`);
    return NextResponse.json({ error: "mission_not_found" }, { status: 404 });
  }

  // Update in-memory
  if (mem) {
    if (!body.enabled) {
      disableMission(body.id);
    } else {
      mem.enabled = true;
    }
  }

  // Update in Supabase
  await updateScheduledMission(body.id, { enabled: body.enabled });

  console.log(`[MissionsAPI] Mission ${body.id} ${body.enabled ? "enabled" : "disabled"} (user: ${scope.userId.slice(0, 8)})`);

  return NextResponse.json({ ok: true, id: body.id, enabled: body.enabled });
}
