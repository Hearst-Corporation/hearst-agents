/**
 * Mission Detail API — Get, update, and delete specific missions.
 */

import { type NextRequest, NextResponse } from "next/server";
import { updateMissionSchema } from "@/lib/contracts/missions";
import { disableMission, evictMission, getMission } from "@/lib/engine/runtime/missions/store";
import {
  deleteScheduledMission,
  getScheduledMissions,
  updateScheduledMission,
} from "@/lib/engine/runtime/state/adapter";
import { requireScope } from "@/lib/platform/auth/scope";

export const dynamic = "force-dynamic";

async function verifyMissionOwnership(id: string, userId: string): Promise<boolean> {
  const memMission = getMission(id);
  if (memMission?.userId && memMission.userId !== userId) {
    return false;
  }
  return true;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { scope, error } = await requireScope({ context: "GET /api/v2/missions/[id]" });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  const { id } = await params;

  // In-memory first (hot path)
  const memMission = getMission(id);
  if (memMission) {
    if (memMission.userId && memMission.userId !== scope.userId) {
      return NextResponse.json({ error: "mission_not_found" }, { status: 404 });
    }
    return NextResponse.json({ mission: memMission });
  }

  // Fallback: Supabase
  const missions = await getScheduledMissions({
    userId: scope.userId,
    tenantId: scope.tenantId,
    workspaceId: scope.workspaceId,
  });
  const mission = missions.find((m) => m.id === id);
  if (!mission) {
    return NextResponse.json({ error: "mission_not_found" }, { status: 404 });
  }

  return NextResponse.json({ mission });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Resolve scope with dev fallback allowed
  const { scope, error } = await requireScope({ context: "PATCH /api/v2/missions/[id]" });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  const { id } = await params;

  // Verify ownership
  if (!(await verifyMissionOwnership(id, scope.userId))) {
    console.warn(`[MissionsAPI] Access denied — user mismatch for mission ${id}`);
    return NextResponse.json({ error: "mission_not_found" }, { status: 404 });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = updateMissionSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const body = parsed.data;

  // Update in-memory
  const memMission = getMission(id);
  if (memMission) {
    if (body.name !== undefined) memMission.name = body.name;
    if (body.prompt !== undefined) memMission.input = body.prompt;
    if (body.budgetUsd !== undefined) {
      memMission.budgetUsd = body.budgetUsd === null ? undefined : body.budgetUsd;
    }
    if (body.approvers !== undefined) {
      memMission.approvers =
        body.approvers === null || body.approvers.length === 0 ? undefined : body.approvers;
    }
    if (body.approvalMode !== undefined) {
      memMission.approvalMode = body.approvalMode;
    }
    if (body.enabled !== undefined) {
      if (body.enabled) {
        memMission.enabled = true;
      } else {
        disableMission(id);
      }
    }
  }

  // Map frequency to schedule
  let schedule: string | undefined;
  if (body.frequency) {
    const schedules: Record<string, string> = {
      daily: "0 9 * * *",
      weekly: "0 9 * * 1",
      monthly: "0 9 1 * *",
    };
    schedule = body.frequency === "custom" ? body.customCron : schedules[body.frequency];
  }

  // Update in Supabase
  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.prompt !== undefined) updates.input = body.prompt;
  if (schedule !== undefined) updates.schedule = schedule;
  if (body.enabled !== undefined) updates.enabled = body.enabled;
  if (body.budgetUsd !== undefined) {
    updates.budgetUsd = body.budgetUsd === null ? undefined : body.budgetUsd;
  }
  if (body.approvers !== undefined) {
    updates.approvers =
      body.approvers === null || body.approvers.length === 0 ? [] : body.approvers;
  }
  if (body.approvalMode !== undefined) {
    updates.approvalMode = body.approvalMode;
  }

  if (Object.keys(updates).length > 0) {
    await updateScheduledMission(id, updates);
  }

  console.log(`[MissionsAPI] Mission ${id} updated (user: ${scope.userId.slice(0, 8)})`);

  return NextResponse.json({
    ok: true,
    id,
    updates: Object.keys(updates),
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Resolve scope with dev fallback allowed
  const { scope, error } = await requireScope({ context: "DELETE /api/v2/missions/[id]" });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  const { id } = await params;

  // Verify ownership
  if (!(await verifyMissionOwnership(id, scope.userId))) {
    console.warn(`[MissionsAPI] Access denied — user mismatch for mission ${id}`);
    return NextResponse.json({ error: "mission_not_found" }, { status: 404 });
  }

  // Hard-delete: remove the row from Supabase + drop the in-memory cache.
  // Previous soft-delete (enabled=false) left the mission visible on the
  // dashboard, which read like a UI bug.
  const dbResult = await deleteScheduledMission(id);
  evictMission(id);

  if (!dbResult.ok) {
    return NextResponse.json({ error: dbResult.error ?? "delete_failed" }, { status: 502 });
  }

  console.log(
    `[MissionsAPI] Mission ${id} deleted (db: ${dbResult.deletedCount}, mem: evicted) (user: ${scope.userId.slice(0, 8)})`,
  );

  return NextResponse.json({ ok: true, id, deleted: true, dbDeleted: dbResult.deletedCount });
}
