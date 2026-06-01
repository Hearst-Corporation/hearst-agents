import { describe, expect, it } from "vitest";
import { shouldPersistEvent } from "@/lib/engine/runtime/timeline/persist";

describe("timeline persist — observability events", () => {
  it("persists failed tool calls and run aborts", () => {
    expect(shouldPersistEvent("tool_call_failed")).toBe(true);
    expect(shouldPersistEvent("run_aborted")).toBe(true);
  });

  it("keeps noisy stream events out of durable timeline", () => {
    expect(shouldPersistEvent("text_delta")).toBe(false);
  });
});
