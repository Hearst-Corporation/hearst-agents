/**
 * Tests unitaires — start_computer_action tool + hearst-action-client.
 *
 * Couvre :
 *  1. Le tool retourne un message avec runId (mocks Supabase + enqueueJob).
 *  2. Fail-soft si HEARST_ACTION_URL absent (sendComputerAction → not_configured).
 *  3. Gating tier : start_computer_action retiré hors tier "action".
 *  4. start_computer_action conservé en tier "action".
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks modules lourds ──────────────────────────────────────────────────────

vi.mock("@/lib/platform/db/supabase", () => ({
  getServerSupabase: vi.fn(() => null), // null = DB indisponible (fail-soft)
}));

vi.mock("@/lib/jobs/queue", () => ({
  enqueueJob: vi.fn().mockResolvedValue({ jobId: "mock-job-id", jobKind: "computer-action-run" }),
}));

vi.mock("@/lib/jobs/inngest/run-persistence", () => ({
  startJobRun: vi.fn().mockResolvedValue("run-test-uuid-1234"),
}));

// ── Imports après mocks ───────────────────────────────────────────────────────

import { gateToolsByTier } from "@/lib/engine/orchestrator/execution-tier";
import { sendComputerAction } from "@/lib/integrations/hearst-action-client";
import { startJobRun } from "@/lib/jobs/inngest/run-persistence";
import { enqueueJob } from "@/lib/jobs/queue";
import { getServerSupabase } from "@/lib/platform/db/supabase";
import { buildComputerActionTools } from "@/lib/tools/native/computer-action";

// ── Scope de test ─────────────────────────────────────────────────────────────

const testScope = {
  userId: "user-test-123",
  tenantId: "tenant-test-456",
  workspaceId: "workspace-test-789",
};

// ── 1. buildComputerActionTools ───────────────────────────────────────────────

describe("buildComputerActionTools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("expose le tool start_computer_action", () => {
    const tools = buildComputerActionTools({ scope: testScope });
    expect(tools).toHaveProperty("start_computer_action");
    expect(typeof tools.start_computer_action.execute).toBe("function");
  });

  it("retourne une erreur si task est vide", async () => {
    const tools = buildComputerActionTools({ scope: testScope });
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const result = await tools.start_computer_action.execute!(
      { task: "" },
      {
        toolCallId: "tc1",
        messages: [],
        abortSignal: new AbortController().signal,
      },
    );
    expect(typeof result).toBe("string");
    expect(result).toContain("Erreur");
  });

  it("retourne une erreur si pas de tenant", async () => {
    const tools = buildComputerActionTools({
      scope: { userId: "", tenantId: "", workspaceId: "" },
    });
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const result = await tools.start_computer_action.execute!(
      { task: "Ouvre apple.com" },
      {
        toolCallId: "tc2",
        messages: [],
        abortSignal: new AbortController().signal,
      },
    );
    expect(typeof result).toBe("string");
    expect(result).toContain("session sans tenant");
  });

  it("fail-soft si DB indisponible (getServerSupabase → null)", async () => {
    vi.mocked(getServerSupabase).mockReturnValueOnce(null);
    const tools = buildComputerActionTools({ scope: testScope });
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const result = await tools.start_computer_action.execute!(
      { task: "Remplis le formulaire" },
      {
        toolCallId: "tc3",
        messages: [],
        abortSignal: new AbortController().signal,
      },
    );
    // DB null → startJobRun non appelé → runId null → message erreur
    expect(typeof result).toBe("string");
    expect(result).toContain("DB indisponible");
  });

  it("retourne un message avec runId quand DB disponible et enqueue OK", async () => {
    // Supabase retourne un client mock (non null)
    const mockSb = {} as ReturnType<typeof getServerSupabase>;
    vi.mocked(getServerSupabase).mockReturnValueOnce(mockSb);
    vi.mocked(startJobRun).mockResolvedValueOnce("run-abc-12345678");
    vi.mocked(enqueueJob).mockResolvedValueOnce({
      jobId: "job-xyz",
      jobKind: "computer-action-run",
    });

    const tools = buildComputerActionTools({ scope: testScope });
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const result = await tools.start_computer_action.execute!(
      { task: "Navigue vers apple.com", context: { url: "https://apple.com" } },
      { toolCallId: "tc4", messages: [], abortSignal: new AbortController().signal },
    );

    expect(typeof result).toBe("string");
    // Le runId est tronqué aux 8 premiers chars
    expect(result).toContain("run-abc-");
    expect(result).toContain("arrière-plan");
  });
});

// ── 2. sendComputerAction — fail-soft HEARST_ACTION_URL absent ────────────────

describe("sendComputerAction — fail-soft", () => {
  const origUrl = process.env.HEARST_ACTION_URL;
  const origKey = process.env.HEARST_ACTION_API_KEY;

  afterEach(() => {
    if (origUrl === undefined) {
      delete process.env.HEARST_ACTION_URL;
    } else {
      process.env.HEARST_ACTION_URL = origUrl;
    }
    if (origKey === undefined) {
      delete process.env.HEARST_ACTION_API_KEY;
    } else {
      process.env.HEARST_ACTION_API_KEY = origKey;
    }
  });

  it("retourne { ok:false, error:'not_configured' } si HEARST_ACTION_URL absent", async () => {
    delete process.env.HEARST_ACTION_URL;
    const result = await sendComputerAction({
      task: "test",
      tenantId: "tenant-test",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("not_configured");
  });

  it("retourne { ok:false, error:'HEARST_ACTION_API_KEY absent' } si URL ok mais clé manquante", async () => {
    process.env.HEARST_ACTION_URL = "https://action.hearst.app";
    delete process.env.HEARST_ACTION_API_KEY;
    const result = await sendComputerAction({
      task: "test",
      tenantId: "tenant-test",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("HEARST_ACTION_API_KEY absent");
  });

  it("ne throw jamais même si fetch échoue", async () => {
    process.env.HEARST_ACTION_URL = "https://unreachable.invalid";
    process.env.HEARST_ACTION_API_KEY = "test-key";
    // fetch vers domaine invalide → AbortError ou TypeError — must not throw
    const result = await sendComputerAction({
      task: "test",
      tenantId: "tenant-test",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

// ── 3. gateToolsByTier — start_computer_action ────────────────────────────────

describe("gateToolsByTier — start_computer_action", () => {
  const tools = ["cortex_search", "kickoff_swarm", "start_computer_action", "search_web"];

  it("retire start_computer_action hors tier action", () => {
    expect(gateToolsByTier(tools, "direct")).not.toContain("start_computer_action");
    expect(gateToolsByTier(tools, "memory")).not.toContain("start_computer_action");
    expect(gateToolsByTier(tools, "swarm")).not.toContain("start_computer_action");
  });

  it("conserve start_computer_action en tier action", () => {
    expect(gateToolsByTier(tools, "action")).toContain("start_computer_action");
  });

  it("retire kickoff_swarm en tier action (seul swarm le conserve)", () => {
    expect(gateToolsByTier(tools, "action")).not.toContain("kickoff_swarm");
  });

  it("conserve cortex_search (non gaté) dans tous les tiers", () => {
    for (const tier of ["direct", "swarm", "action", "memory"] as const) {
      expect(gateToolsByTier(tools, tier)).toContain("cortex_search");
    }
  });
});
