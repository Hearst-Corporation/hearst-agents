import { describe, expect, it, vi } from "vitest";
import type { RunEventBus } from "@/lib/events/bus";
import { LogPersister } from "@/lib/events/consumers/log-persister";
import type { RunEvent } from "@/lib/events/types";

function makeDb() {
  const insert = vi.fn().mockResolvedValue({ error: null });
  return {
    insert,
    db: {
      from: vi.fn(() => ({ insert })),
    },
  };
}

function makeBus(event: RunEvent): RunEventBus {
  return {
    on: vi.fn((handler: (event: RunEvent) => Promise<void>) => {
      void handler(event);
      return vi.fn();
    }),
  } as unknown as RunEventBus;
}

describe("LogPersister — observability events", () => {
  it("persists tool_call_failed", async () => {
    const { db, insert } = makeDb();
    new LogPersister(db as never).attach(
      makeBus({
        type: "tool_call_failed",
        run_id: "run-1",
        step_id: "step-1",
        timestamp: "2026-06-01T00:00:00.000Z",
        tool: "SLACK_SEND_MESSAGE",
        error: "boom",
      }),
    );

    await vi.waitFor(() => expect(insert).toHaveBeenCalledTimes(1));
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        run_id: "run-1",
        step_id: "step-1",
        level: "error",
        actor: "runtime",
        message: "Tool SLACK_SEND_MESSAGE failed: boom",
      }),
    );
  });

  it("persists run_aborted", async () => {
    const { db, insert } = makeDb();
    new LogPersister(db as never).attach(
      makeBus({
        type: "run_aborted",
        run_id: "run-1",
        timestamp: "2026-06-01T00:00:00.000Z",
        reason: "client_requested",
      }),
    );

    await vi.waitFor(() => expect(insert).toHaveBeenCalledTimes(1));
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        run_id: "run-1",
        level: "warning",
        actor: "runtime",
        message: "client_requested",
      }),
    );
  });
});
