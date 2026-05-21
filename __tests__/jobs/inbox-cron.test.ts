/**
 * inbox-cron — vérifie :
 *  - sans REDIS_URL : startInboxCron est no-op + log warn
 *  - avec mock queue : repeatable jobs ajoutés pour chaque user actif
 *  - appel répété de startInboxCron : idempotent (state reset entre tests)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// server-only est un guard Next.js — no-op en vitest.
vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  getBullConnection: vi.fn(),
  getServerSupabase: vi.fn(),
  queueAdd: vi.fn(),
  queueRemoveRepeatable: vi.fn(),
  queueClose: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock("@/lib/observability/logger", () => ({
  logger: {
    info: mocks.loggerInfo,
    warn: mocks.loggerWarn,
    error: vi.fn(),
    debug: vi.fn(),
  },
  withRoute: () => ({
    info: mocks.loggerInfo,
    warn: mocks.loggerWarn,
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("@/lib/jobs/connection", () => ({
  getBullConnection: mocks.getBullConnection,
}));

vi.mock("@/lib/platform/db/supabase", () => ({
  getServerSupabase: mocks.getServerSupabase,
}));

vi.mock("bullmq", () => ({
  Queue: function MockQueue() {
    return {
      add: mocks.queueAdd,
      removeRepeatable: mocks.queueRemoveRepeatable,
      close: mocks.queueClose,
    };
  },
}));

import {
  registerInboxRepeatable,
  resetInboxCronForTests,
  startInboxCron,
} from "@/lib/jobs/scheduled/inbox-cron";

function makeSupabaseStub(rows: Array<{ config: unknown }>) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: rows, error: null }),
          }),
        }),
      }),
    }),
  };
}

describe("inbox-cron — BullMQ Repeatable Jobs", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((m) => m.mockReset());
    mocks.queueAdd.mockResolvedValue({ id: "job-1" });
    mocks.queueRemoveRepeatable.mockResolvedValue(undefined);
    mocks.queueClose.mockResolvedValue(undefined);
    resetInboxCronForTests();
  });

  afterEach(() => {
    resetInboxCronForTests();
  });

  it("sans REDIS_URL : no-op + log warn", async () => {
    mocks.getBullConnection.mockReturnValue(null);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await startInboxCron();

    expect(mocks.queueAdd).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("REDIS_URL absent"));
    warnSpy.mockRestore();
  });

  it("avec mock queue : ajoute un repeatable job pour chaque user actif (jobId déterministe)", async () => {
    mocks.getBullConnection.mockReturnValue({} as never);
    mocks.getServerSupabase.mockReturnValue(
      makeSupabaseStub([
        { config: { userId: "u1", tenantId: "t1", workspaceId: "w1" } },
        { config: { userId: "u2", tenantId: "t1", workspaceId: "w1" } },
        // Doublon → dédupliqué côté getActiveInboxUsers
        { config: { userId: "u1", tenantId: "t1", workspaceId: "w1" } },
        // Config invalide → ignoré
        { config: { userId: "u3" } },
      ]) as never,
    );

    await startInboxCron();

    expect(mocks.queueAdd).toHaveBeenCalledTimes(2);
    const firstCall = mocks.queueAdd.mock.calls[0];
    expect(firstCall[0]).toBe("inbox-fetch");
    expect(firstCall[2]).toMatchObject({
      jobId: "inbox-fetch:repeat:u1:t1:w1",
      repeat: { every: 30 * 60_000 },
    });
    const secondCall = mocks.queueAdd.mock.calls[1];
    expect(secondCall[2]).toMatchObject({
      jobId: "inbox-fetch:repeat:u2:t1:w1",
    });
  });

  it("startInboxCron appelé plusieurs fois : idempotent (deuxième appel court-circuité)", async () => {
    mocks.getBullConnection.mockReturnValue({} as never);
    mocks.getServerSupabase.mockReturnValue(
      makeSupabaseStub([{ config: { userId: "u1", tenantId: "t1", workspaceId: "w1" } }]) as never,
    );

    await startInboxCron();
    await startInboxCron();
    await startInboxCron();

    // Une seule ronde de registration — la dédup se fait côté `_started`
    // ET côté BullMQ (jobId déterministe), donc même si `_started` était
    // bypass, BullMQ refuserait le doublon.
    expect(mocks.queueAdd).toHaveBeenCalledTimes(1);
  });

  it("registerInboxRepeatable : appelable hors boot (event app.user.connected)", async () => {
    mocks.getBullConnection.mockReturnValue({} as never);
    mocks.getServerSupabase.mockReturnValue(makeSupabaseStub([]) as never);

    await startInboxCron();
    expect(mocks.queueAdd).not.toHaveBeenCalled();

    await registerInboxRepeatable({
      userId: "u-new",
      tenantId: "t1",
      workspaceId: "w1",
    });

    expect(mocks.queueAdd).toHaveBeenCalledTimes(1);
    expect(mocks.queueAdd.mock.calls[0][2]).toMatchObject({
      jobId: "inbox-fetch:repeat:u-new:t1:w1",
    });
  });

  it("zéro user actif : log informatif, aucun add", async () => {
    mocks.getBullConnection.mockReturnValue({} as never);
    mocks.getServerSupabase.mockReturnValue(makeSupabaseStub([]) as never);

    await startInboxCron();
    expect(mocks.queueAdd).not.toHaveBeenCalled();
    // logger.info est appelé avec (message) ou (obj, message) selon pino — on vérifie l'un ou l'autre.
    const calledWithNoActiveUsers = mocks.loggerInfo.mock.calls.some((args) =>
      args.some((a: unknown) => typeof a === "string" && a.includes("no active users")),
    );
    expect(calledWithNoActiveUsers).toBe(true);
  });
});
