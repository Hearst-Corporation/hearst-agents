/**
 * POST /api/v2/missions/[id]/pause
 *
 * Pause an active mission or watcher.
 * Canonical: uses runtime missions store with scope/auth.
 */

import { type NextRequest, NextResponse } from "next/server";
import { pauseMissionSchema } from "@/lib/contracts/missions";
import { pauseMission as pausePlannerMission } from "@/lib/engine/planner/mission-engine";
import { getMission as getPlannerMission } from "@/lib/engine/planner/store";
import {
  disableMission,
  getMission as getRuntimeMission,
} from "@/lib/engine/runtime/missions/store";
import { getScheduledMissions, updateScheduledMission } from "@/lib/engine/runtime/state/adapter";
import { verifyMissionOwnership } from "@/lib/missions/ownership";
import { logger } from "@/lib/observability/logger";
import { requireScope } from "@/lib/platform/auth/scope";
import { parseJsonBody } from "@/lib/platform/http/parse-body";
import { manifestMission } from "@/lib/ui/right-panel/manifestation";
import { redactId } from "@/lib/utils/redact";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  // Resolve scope with dev fallback allowed
  const { scope, error } = await requireScope({ context: "POST /api/v2/missions/[id]/pause" });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  // Body optionnel — strict empty si fourni.
  const contentLength = req.headers.get("content-length");
  if (contentLength && contentLength !== "0") {
    const parsed = await parseJsonBody(req, pauseMissionSchema);
    if (!parsed.ok) return parsed.response;
  }

  const missionId = (await params).id;

  try {
    // ── 1. Try runtime missions (canonical) ───────────────────
    const runtimeMission = getRuntimeMission(missionId);
    if (runtimeMission) {
      // Verify ownership via canonical guard (fail-closed cross-tenant IDOR)
      const owns = await verifyMissionOwnership(missionId, scope.userId, scope.tenantId);
      if (!owns) {
        logger.warn(
          {
            event: "idor_attempt",
            action: "pause",
            missionId,
            userId: redactId(scope.userId),
            tenantId: redactId(scope.tenantId),
          },
          "Mission pause blocked — ownership mismatch",
        );
        return NextResponse.json({ error: "mission_not_found" }, { status: 404 });
      }

      // Already disabled (paused)
      if (!runtimeMission.enabled) {
        return NextResponse.json({
          success: true,
          message: "Mission already paused",
          missionId: runtimeMission.id,
          status: "paused",
        });
      }

      // Pause by disabling
      disableMission(missionId);
      await updateScheduledMission(missionId, { enabled: false });

      logger.info(
        { missionId, userId: redactId(scope.userId) },
        "[MissionsAPI] Runtime mission paused",
      );

      return NextResponse.json({
        success: true,
        missionId: runtimeMission.id,
        status: "paused",
      });
    }

    // ── 2. Fallback: try persisted runtime missions ───────────
    const persisted = await getScheduledMissions({
      userId: scope.userId,
      tenantId: scope.tenantId,
      workspaceId: scope.workspaceId,
    });
    const persistedMission = persisted.find((m) => m.id === missionId);

    if (persistedMission) {
      if (!persistedMission.enabled) {
        return NextResponse.json({
          success: true,
          message: "Mission already paused",
          missionId: persistedMission.id,
          status: "paused",
        });
      }

      await updateScheduledMission(missionId, { enabled: false });
      logger.info(
        { missionId, userId: redactId(scope.userId) },
        "[MissionsAPI] Persisted mission paused",
      );

      return NextResponse.json({
        success: true,
        missionId: persistedMission.id,
        status: "paused",
      });
    }

    // ── 3. Fallback: planner missions (legacy) ─────────────────
    const plannerMission = getPlannerMission(missionId);
    if (plannerMission) {
      if (plannerMission.status === "paused") {
        return NextResponse.json({
          success: true,
          message: "Mission already paused",
          mission: manifestMission(plannerMission),
        });
      }

      if (plannerMission.status !== "active") {
        return NextResponse.json(
          { error: `Cannot pause mission with status: ${plannerMission.status}` },
          { status: 400 },
        );
      }

      const pausedMission = pausePlannerMission(missionId);
      if (!pausedMission) {
        console.error(`[MissionsAPI] Failed to pause planner mission: ${missionId}`);
        return NextResponse.json({ error: "Failed to pause mission" }, { status: 500 });
      }

      logger.info({ missionId }, "[MissionsAPI] Planner mission paused");

      return NextResponse.json({
        success: true,
        missionId: pausedMission.id,
        status: pausedMission.status,
        focalObject: manifestMission(pausedMission),
      });
    }

    // ── 4. Not found ───────────────────────────────────────────
    console.warn(`[MissionsAPI] Mission not found: ${missionId}`);
    return NextResponse.json({ error: "mission_not_found" }, { status: 404 });
  } catch (err) {
    console.error(`[MissionsAPI] Error pausing mission ${missionId}:`, err);
    return NextResponse.json(
      {
        error: "Failed to pause mission",
        message: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
