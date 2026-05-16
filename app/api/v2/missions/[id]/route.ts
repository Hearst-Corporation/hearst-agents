/**
 * Mission Detail API — Get, update, and delete specific missions.
 */

import { NextResponse } from "next/server";
import { updateMissionSchema } from "@/lib/contracts/missions";
import { disableMission, evictMission, getMission } from "@/lib/engine/runtime/missions/store";
import {
  deleteScheduledMission,
  getScheduledMissions,
  updateScheduledMission,
} from "@/lib/engine/runtime/state/adapter";
import { verifyMissionOwnership } from "@/lib/missions/ownership";
import { logger } from "@/lib/observability/logger";
import { parseJsonBody } from "@/lib/platform/http/parse-body";
import { withScope } from "@/lib/platform/http/route-handler";
import { redactId } from "@/lib/utils/redact";

export const dynamic = "force-dynamic";

export const GET = withScope<{ id: string }>(
  "GET /api/v2/missions/[id]",
  async (_req, { scope, params }) => {
    const { id } = params;

    // Verify ownership (user + tenant) — cohérent avec PATCH/DELETE pour
    // éviter une asymétrie sécurité (GET ne doit pas être plus permissif).
    if (!(await verifyMissionOwnership(id, scope.userId, scope.tenantId))) {
      logger.warn(
        {
          event: "idor_attempt",
          action: "read",
          missionId: id,
          userId: redactId(scope.userId),
          tenantId: redactId(scope.tenantId),
        },
        "Mission IDOR attempt blocked (GET)",
      );
      return NextResponse.json({ error: "mission_not_found" }, { status: 404 });
    }

    // In-memory first (hot path)
    const memMission = getMission(id);
    if (memMission) {
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
  },
);

export const PATCH = withScope<{ id: string }>(
  "PATCH /api/v2/missions/[id]",
  async (req, { scope, params }) => {
    const { id } = params;

    // Verify ownership (user + tenant)
    if (!(await verifyMissionOwnership(id, scope.userId, scope.tenantId))) {
      logger.warn(
        {
          event: "idor_attempt",
          action: "update",
          missionId: id,
          userId: redactId(scope.userId),
          tenantId: redactId(scope.tenantId),
        },
        "Mission IDOR attempt blocked (PATCH)",
      );
      return NextResponse.json({ error: "mission_not_found" }, { status: 404 });
    }

    const parsed = await parseJsonBody(req, updateMissionSchema);
    if (!parsed.ok) return parsed.response;
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
      await updateScheduledMission(id, updates, scope.userId);
    }

    logger.info(
      {
        event: "mission_updated",
        missionId: id,
        userId: redactId(scope.userId),
        fields: Object.keys(updates),
      },
      "Mission updated",
    );

    return NextResponse.json({
      ok: true,
      id,
      updates: Object.keys(updates),
    });
  },
);

export const DELETE = withScope<{ id: string }>(
  "DELETE /api/v2/missions/[id]",
  async (_req, { scope, params }) => {
    const { id } = params;

    // Verify ownership (user + tenant)
    if (!(await verifyMissionOwnership(id, scope.userId, scope.tenantId))) {
      logger.warn(
        {
          event: "idor_attempt",
          action: "delete",
          missionId: id,
          userId: redactId(scope.userId),
          tenantId: redactId(scope.tenantId),
        },
        "Mission IDOR attempt blocked (DELETE)",
      );
      return NextResponse.json({ error: "mission_not_found" }, { status: 404 });
    }

    // Hard-delete: remove the row from Supabase + drop the in-memory cache.
    // userId passé en défense-en-profondeur : le filtre SQL garantit 0 rows
    // affectées si ownership invalide (ne devrait pas arriver après verifyMissionOwnership).
    const dbResult = await deleteScheduledMission(id, scope.userId);
    evictMission(id);

    if (!dbResult.ok) {
      return NextResponse.json({ error: dbResult.error ?? "delete_failed" }, { status: 502 });
    }

    logger.info(
      {
        event: "mission_deleted",
        missionId: id,
        userId: redactId(scope.userId),
        dbDeleted: dbResult.deletedCount,
      },
      "Mission deleted",
    );

    return NextResponse.json({ ok: true, id, deleted: true, dbDeleted: dbResult.deletedCount });
  },
);
