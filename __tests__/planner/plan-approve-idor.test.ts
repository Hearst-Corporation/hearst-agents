/**
 * Régression IDOR — ownership check sur approve + decline (route-level).
 *
 * Prouve que l'ownership check (plan.userId !== scope.userId) déclenche
 * systématiquement un 404 uniforme AVANT toute mutation du plan, et que
 * le plan reste inchangé en cas de tentative d'IDOR.
 *
 * Pattern : vi.hoisted + vi.mock sur requireScope / planner / pipeline,
 * import dynamique du handler — identique à __tests__/api/missions-messages.test.ts.
 */

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearAllPlannerStores, getPlan, savePlan } from "@/lib/engine/planner/store";
import type { ExecutionPlan } from "@/lib/engine/planner/types";

// ── Mocks ────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  requireScope: vi.fn(),
  approvePlan: vi.fn(),
  declinePlan: vi.fn(),
  approveAndResume: vi.fn(),
  withRoute: vi.fn(() => ({
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  })),
  redactedError: vi.fn((e: unknown) => e),
  redactId: vi.fn((id: string) => id),
}));

vi.mock("@/lib/platform/auth/scope", () => ({
  requireScope: mocks.requireScope,
}));

vi.mock("@/lib/engine/planner/index", () => ({
  approvePlan: mocks.approvePlan,
  declinePlan: mocks.declinePlan,
}));

vi.mock("@/lib/engine/planner/pipeline", () => ({
  approveAndResume: mocks.approveAndResume,
}));

vi.mock("@/lib/observability/logger", () => ({
  withRoute: mocks.withRoute,
  redactedError: mocks.redactedError,
}));

vi.mock("@/lib/utils/redact", () => ({
  redactId: mocks.redactId,
}));

// ── Fixtures ─────────────────────────────────────────────────

const OWNER_SCOPE = {
  userId: "user-owner",
  tenantId: "tenant-A",
  workspaceId: "ws-A",
  isDevFallback: false,
};

const ATTACKER_SCOPE = {
  userId: "user-attacker",
  tenantId: "tenant-B",
  workspaceId: "ws-B",
  isDevFallback: false,
};

function makePlan(overrides?: Partial<ExecutionPlan>): ExecutionPlan {
  const plan: ExecutionPlan = {
    id: "plan-victim-001",
    threadId: "thread-1",
    userId: OWNER_SCOPE.userId,
    tenantId: OWNER_SCOPE.tenantId,
    workspaceId: "ws-A",
    intent: "envoie le rapport",
    type: "one_shot",
    status: "awaiting_approval",
    requiresApproval: true,
    approvalStepId: "gate-1",
    steps: [
      {
        id: "gate-1",
        kind: "wait_for_approval",
        title: "Validation requise",
        dependsOn: [],
        risk: "low",
        status: "pending",
      },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
  savePlan(plan);
  return plan;
}

function makeReq(url: string, body?: unknown): NextRequest {
  return new NextRequest(new URL(url, "http://localhost"), {
    method: "POST",
    body: body ? JSON.stringify(body) : null,
    headers: body ? { "content-type": "application/json" } : undefined,
  });
}

// ── Tests approve ─────────────────────────────────────────────

describe("POST /api/v2/plans/[id]/approve — ownership check IDOR", () => {
  afterEach(() => {
    clearAllPlannerStores();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    mocks.requireScope.mockResolvedValue({ scope: ATTACKER_SCOPE, error: null });
  });

  it("IDOR approve : user B tente d'approuver un plan de user A → 404", async () => {
    makePlan();
    const { POST } = await import("@/app/api/v2/plans/[id]/approve/route");
    const res = await POST(
      makeReq("http://localhost/api/v2/plans/plan-victim-001/approve", { threadId: "t-1" }),
      { params: Promise.resolve({ id: "plan-victim-001" }) },
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Plan not found or not awaiting approval");
    // Le plan ne doit PAS avoir été muté
    expect(mocks.approvePlan).not.toHaveBeenCalled();
    expect(mocks.approveAndResume).not.toHaveBeenCalled();
    expect(getPlan("plan-victim-001")?.status).toBe("awaiting_approval");
  });

  it("IDOR approve : tenant B tente via userId owner mais tenantId différent → 404", async () => {
    makePlan(); // owné par tenant-A
    mocks.requireScope.mockResolvedValue({
      scope: { ...OWNER_SCOPE, userId: OWNER_SCOPE.userId, tenantId: "tenant-B" },
      error: null,
    });
    const { POST } = await import("@/app/api/v2/plans/[id]/approve/route");
    const res = await POST(
      makeReq("http://localhost/api/v2/plans/plan-victim-001/approve", { threadId: "t-1" }),
      { params: Promise.resolve({ id: "plan-victim-001" }) },
    );
    expect(res.status).toBe(404);
    expect(mocks.approvePlan).not.toHaveBeenCalled();
  });

  it("approve owner légitime : passe l'ownership check et atteint la mutation", async () => {
    makePlan();
    mocks.requireScope.mockResolvedValue({ scope: OWNER_SCOPE, error: null });
    // Mock approvePlan pour retourner un plan sentinel (ownership franchie → mutation atteinte)
    const approvedSentinel: ExecutionPlan = {
      id: "plan-victim-001",
      threadId: "thread-1",
      userId: OWNER_SCOPE.userId,
      tenantId: OWNER_SCOPE.tenantId,
      workspaceId: "ws-A",
      intent: "envoie le rapport",
      type: "one_shot",
      status: "executing",
      requiresApproval: true,
      approvalStepId: "gate-1",
      steps: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    mocks.approvePlan.mockReturnValue(approvedSentinel);
    // Mock approveAndResume pour éviter l'explosion de pipeline post-mutation
    mocks.approveAndResume.mockResolvedValue({
      plan: approvedSentinel,
      focalObject: null,
      assets: [],
    });
    const { POST } = await import("@/app/api/v2/plans/[id]/approve/route");
    // Poster AVEC threadId pour dépasser la garde threadId et atteindre l'ownership check
    const res = await POST(
      makeReq("http://localhost/api/v2/plans/plan-victim-001/approve", { threadId: "t-1" }),
      { params: Promise.resolve({ id: "plan-victim-001" }) },
    );
    // La mutation doit avoir été atteinte — prouve que l'ownership check a été FRANCHI par le owner
    expect(mocks.approvePlan).toHaveBeenCalledWith("plan-victim-001");
    // Status ni 404 (ownership bloqué) ni 403
    expect(res.status).not.toBe(404);
    expect(res.status).not.toBe(403);
  });

  it("approve plan inexistant → 404 (pas d'IDOR info leak)", async () => {
    // Aucun plan seeded — getPlan retourne null
    const { POST } = await import("@/app/api/v2/plans/[id]/approve/route");
    const res = await POST(
      makeReq("http://localhost/api/v2/plans/plan-inexistant/approve", { threadId: "t-1" }),
      { params: Promise.resolve({ id: "plan-inexistant" }) },
    );
    expect(res.status).toBe(404);
    expect(mocks.approvePlan).not.toHaveBeenCalled();
  });
});

// ── Tests decline ─────────────────────────────────────────────

describe("POST /api/v2/plans/[id]/decline — ownership check IDOR", () => {
  afterEach(() => {
    clearAllPlannerStores();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    mocks.requireScope.mockResolvedValue({ scope: ATTACKER_SCOPE, error: null });
  });

  it("IDOR decline : user B tente de décliner un plan de user A → 404", async () => {
    makePlan();
    const { POST } = await import("@/app/api/v2/plans/[id]/decline/route");
    const res = await POST(
      makeReq("http://localhost/api/v2/plans/plan-victim-001/decline", { threadId: "t-1" }),
      { params: Promise.resolve({ id: "plan-victim-001" }) },
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Plan not found or not awaiting approval");
    // Le plan ne doit PAS avoir été muté
    expect(mocks.declinePlan).not.toHaveBeenCalled();
    expect(getPlan("plan-victim-001")?.status).toBe("awaiting_approval");
  });

  it("IDOR decline : tenant B tente via userId owner mais tenantId différent → 404", async () => {
    makePlan();
    mocks.requireScope.mockResolvedValue({
      scope: { ...OWNER_SCOPE, userId: OWNER_SCOPE.userId, tenantId: "tenant-B" },
      error: null,
    });
    const { POST } = await import("@/app/api/v2/plans/[id]/decline/route");
    const res = await POST(
      makeReq("http://localhost/api/v2/plans/plan-victim-001/decline", { threadId: "t-1" }),
      { params: Promise.resolve({ id: "plan-victim-001" }) },
    );
    expect(res.status).toBe(404);
    expect(mocks.declinePlan).not.toHaveBeenCalled();
  });

  it("decline owner légitime : passe l'ownership check et atteint la mutation", async () => {
    makePlan();
    mocks.requireScope.mockResolvedValue({ scope: OWNER_SCOPE, error: null });
    // Mock declinePlan pour retourner un plan sentinel (ownership franchie → mutation atteinte)
    const declinedSentinel: ExecutionPlan = {
      id: "plan-victim-001",
      threadId: "thread-1",
      userId: OWNER_SCOPE.userId,
      tenantId: OWNER_SCOPE.tenantId,
      workspaceId: "ws-A",
      intent: "envoie le rapport",
      type: "one_shot",
      status: "declined",
      requiresApproval: true,
      approvalStepId: "gate-1",
      steps: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    mocks.declinePlan.mockReturnValue(declinedSentinel);
    const { POST } = await import("@/app/api/v2/plans/[id]/decline/route");
    // Poster AVEC threadId pour dépasser la garde threadId et atteindre l'ownership check
    const res = await POST(
      makeReq("http://localhost/api/v2/plans/plan-victim-001/decline", { threadId: "t-1" }),
      { params: Promise.resolve({ id: "plan-victim-001" }) },
    );
    // La mutation doit avoir été atteinte — prouve que l'ownership check a été FRANCHI par le owner
    expect(mocks.declinePlan).toHaveBeenCalledWith("plan-victim-001");
    // Status ni 404 (ownership bloqué) ni 403
    expect(res.status).not.toBe(404);
    expect(res.status).not.toBe(403);
  });

  it("decline plan inexistant → 404 (pas d'IDOR info leak)", async () => {
    const { POST } = await import("@/app/api/v2/plans/[id]/decline/route");
    const res = await POST(
      makeReq("http://localhost/api/v2/plans/plan-inexistant/decline", { threadId: "t-1" }),
      { params: Promise.resolve({ id: "plan-inexistant" }) },
    );
    expect(res.status).toBe(404);
    expect(mocks.declinePlan).not.toHaveBeenCalled();
  });
});
