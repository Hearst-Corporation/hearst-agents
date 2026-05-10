import { NextResponse } from "next/server";
import { getScheduledMissions } from "@/lib/engine/runtime/state/adapter";
import { getAllMissions as getMemoryMissions } from "@/lib/engine/runtime/missions/store";
import { getAllMissionOps } from "@/lib/engine/runtime/missions/ops-store";
import { requireScope } from "@/lib/platform/auth/scope";
import type { MissionOpsRecord } from "@/lib/engine/runtime/missions/ops-types";
import { getApprovalState } from "@/lib/missions/approvals";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error: authError } = await requireScope({ context: "GET /api/v2/missions/ops" });
  if (authError) return NextResponse.json({ error: authError.message }, { status: authError.status });

  try {
    let missionList = await getScheduledMissions();

    if (missionList.length === 0) {
      missionList = getMemoryMissions().map((m) => ({
        id: m.id,
        tenantId: m.tenantId,
        workspaceId: m.workspaceId,
        userId: m.userId,
        name: m.name,
        input: m.input,
        schedule: m.schedule,
        enabled: m.enabled,
        createdAt: m.createdAt,
        lastRunAt: m.lastRunAt,
        lastRunId: m.lastRunId,
        approvers: m.approvers,
        approvalMode: m.approvalMode,
      }));
    }

    const opsMap = getAllMissionOps();

    // Récupère en parallèle l'état d'approbation des missions qui ont
    // des approvers configurés. Best-effort — un échec DB ne casse pas
    // l'endpoint, l'approval state est juste absent du payload.
    const approvalStates = await Promise.all(
      missionList.map(async (m) => {
        if (!m.approvers || m.approvers.length === 0) return null;
        try {
          return await getApprovalState(m.id);
        } catch {
          return null;
        }
      }),
    );
    const approvalByMissionId = new Map<string, ReturnType<typeof toApprovalSummary>>();
    missionList.forEach((m, idx) => {
      const state = approvalStates[idx];
      if (state && state.pending > 0) {
        approvalByMissionId.set(m.id, toApprovalSummary(state));
      }
    });

    const missions: MissionOpsRecord[] = missionList.map((m) => {
      const live = opsMap.get(m.id);

      // In-memory live status takes priority for "running" detection;
      // persisted fields are the durable source of truth for everything else.
      const isLiveRunning = live?.status === "running";

      return {
        missionId: m.id,
        name: m.name,
        tenantId: m.tenantId,
        workspaceId: m.workspaceId,
        enabled: m.enabled,
        status: isLiveRunning ? "running" : (m.lastRunStatus ?? live?.lastRunStatus ?? "idle"),
        lastRunAt: live?.lastRunAt ?? m.lastRunAt,
        lastRunId: live?.lastRunId ?? m.lastRunId,
        lastRunStatus: live?.lastRunStatus ?? m.lastRunStatus,
        lastError: live?.lastError ?? m.lastError,
        runningSince: isLiveRunning ? live?.runningSince : undefined,
        // Drift Alert (S3-E) — exposé au cockpit pour afficher le badge gold.
        drift: live?.drift,
        // Q3-D — approbation collaborative en cours pour cette mission
        approval: approvalByMissionId.get(m.id),
      };
    });

    return NextResponse.json({ missions });
  } catch (e) {
    console.error("GET /api/v2/missions/ops:", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

function toApprovalSummary(state: {
  mode: "all" | "any" | "majority";
  total: number;
  approved: number;
  rejected: number;
  pending: number;
}): NonNullable<MissionOpsRecord["approval"]> {
  return {
    mode: state.mode,
    total: state.total,
    approved: state.approved,
    rejected: state.rejected,
    pending: state.pending,
  };
}
