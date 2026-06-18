/**
 * IDOR guard — POST /api/v2/plans/[id]/approve
 *
 * requireScope authentifie mais N'autorise PAS : sans check d'ownership,
 * n'importe quel user authentifié approuverait le plan d'un autre par son id.
 * Ce test verrouille le guard (miroir de approve-step F-056).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireScope, getPlan, approvePlan, approveAndResume } = vi.hoisted(() => ({
  requireScope: vi.fn(),
  getPlan: vi.fn(),
  approvePlan: vi.fn(),
  approveAndResume: vi.fn(),
}));

vi.mock("@/lib/platform/auth/scope", () => ({ requireScope }));
vi.mock("@/lib/engine/planner/store", () => ({ getPlan }));
vi.mock("@/lib/engine/planner/index", () => ({ approvePlan }));
vi.mock("@/lib/engine/planner/pipeline", () => ({ approveAndResume }));
vi.mock("@/lib/observability/logger", () => ({
  withRoute: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
  redactedError: (e: unknown) => e,
}));

import { POST } from "@/app/api/v2/plans/[id]/approve/route";

function makeReq(): Request {
  return new Request("http://localhost/api/v2/plans/p-1/approve", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ threadId: "thread-1" }),
  });
}

const params = Promise.resolve({ id: "p-1" });

beforeEach(() => {
  requireScope.mockReset();
  getPlan.mockReset();
  approvePlan.mockReset();
  approveAndResume.mockReset();
  // Caller authentifié = user-A / tenant-A
  requireScope.mockResolvedValue({ scope: { userId: "user-A", tenantId: "t-A" }, error: null });
  approvePlan.mockReturnValue({ id: "p-1", type: "demo", status: "approved" });
  approveAndResume.mockResolvedValue({
    plan: { id: "p-1", status: "completed" },
    focalObject: null,
    assets: [],
  });
});

describe("POST /api/v2/plans/[id]/approve — IDOR guard", () => {
  it("bloque l'approbation d'un plan appartenant à un AUTRE user → 404, approvePlan jamais appelé", async () => {
    getPlan.mockReturnValue({ id: "p-1", userId: "user-B", tenantId: "t-A" });

    const res = await POST(makeReq() as never, { params } as never);

    expect(res.status).toBe(404);
    expect(approvePlan).not.toHaveBeenCalled();
    expect(approveAndResume).not.toHaveBeenCalled();
  });

  it("bloque l'approbation cross-tenant (même user, autre tenant) → 404", async () => {
    getPlan.mockReturnValue({ id: "p-1", userId: "user-A", tenantId: "t-OTHER" });

    const res = await POST(makeReq() as never, { params } as never);

    expect(res.status).toBe(404);
    expect(approvePlan).not.toHaveBeenCalled();
  });

  it("plan introuvable → 404", async () => {
    getPlan.mockReturnValue(undefined);

    const res = await POST(makeReq() as never, { params } as never);

    expect(res.status).toBe(404);
    expect(approvePlan).not.toHaveBeenCalled();
  });

  it("le propriétaire (user-A / tenant-A) → approvePlan appelé, 200", async () => {
    getPlan.mockReturnValue({ id: "p-1", userId: "user-A", tenantId: "t-A" });

    const res = await POST(makeReq() as never, { params } as never);

    expect(res.status).toBe(200);
    expect(approvePlan).toHaveBeenCalledWith("p-1");
  });

  it("plan sans tenantId (legacy) appartenant au user → autorisé", async () => {
    getPlan.mockReturnValue({ id: "p-1", userId: "user-A", tenantId: undefined });

    const res = await POST(makeReq() as never, { params } as never);

    expect(res.status).toBe(200);
    expect(approvePlan).toHaveBeenCalledWith("p-1");
  });
});
