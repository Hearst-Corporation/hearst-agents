/**
 * Unit — declinePlan (miroir de approvePlan).
 *
 * Prouve :
 *  - awaiting_approval → declined (terminal), gate pending → skipped.
 *  - plan absent → null.
 *  - mauvais statut (ex. executing) → null (garde de transition).
 *  - declined est terminal (isPlanTerminal).
 */

import { afterEach, describe, expect, it } from "vitest";
import { declinePlan } from "@/lib/engine/planner/index";
import { clearAllPlannerStores, getPlan, savePlan } from "@/lib/engine/planner/store";
import type { ExecutionPlan, PlanStatus } from "@/lib/engine/planner/types";
import { isPlanTerminal } from "@/lib/engine/planner/types";

function makePlan(status: PlanStatus, gatePending = true): ExecutionPlan {
  const id = `plan_${Math.random().toString(36).slice(2)}`;
  const plan: ExecutionPlan = {
    id,
    threadId: "thread-1",
    userId: "user-1",
    tenantId: "tenant-1",
    workspaceId: "default",
    intent: "envoie le rapport",
    type: "one_shot",
    status,
    requiresApproval: true,
    approvalStepId: "gate-1",
    steps: [
      {
        id: "gate-1",
        kind: "wait_for_approval",
        title: "Approval required",
        dependsOn: [],
        risk: "low",
        status: gatePending ? "pending" : "done",
      },
      {
        id: "step-2",
        kind: "deliver",
        title: "Envoyer",
        dependsOn: ["gate-1"],
        risk: "high",
        status: "pending",
      },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  savePlan(plan);
  return plan;
}

describe("declinePlan", () => {
  afterEach(() => clearAllPlannerStores());

  it("awaiting_approval → declined, gate pending → skipped", () => {
    const plan = makePlan("awaiting_approval");
    const result = declinePlan(plan.id);

    expect(result).not.toBeNull();
    expect(result?.status).toBe("declined");
    const gate = result?.steps.find((s) => s.kind === "wait_for_approval");
    expect(gate?.status).toBe("skipped");
    expect(typeof gate?.completedAt).toBe("number");
    // persisté dans le store
    expect(getPlan(plan.id)?.status).toBe("declined");
  });

  it("declined est terminal", () => {
    const plan = makePlan("awaiting_approval");
    const result = declinePlan(plan.id);
    expect(isPlanTerminal(result!.status)).toBe(true);
  });

  it("plan absent → null", () => {
    expect(declinePlan("plan_inexistant")).toBeNull();
  });

  it("mauvais statut (executing) → null (garde de transition)", () => {
    const plan = makePlan("executing", false);
    expect(declinePlan(plan.id)).toBeNull();
    // statut inchangé
    expect(getPlan(plan.id)?.status).toBe("executing");
  });
});
