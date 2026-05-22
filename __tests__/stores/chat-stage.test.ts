/**
 * @vitest-environment jsdom
 *
 * Chat Stage Store — run lifecycle, streaming deltas, tool calls.
 *
 * Store VOLATILE : pas de localStorage à nettoyer, juste reset entre
 * chaque test via `reset()`.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { useChatStageStore } from "@/stores/chat-stage";

describe("useChatStageStore", () => {
  beforeEach(() => {
    useChatStageStore.getState().reset();
  });

  it("resetForNewRun vide messages et toolCalls, passe runState à streaming et efface runError", () => {
    const store = useChatStageStore.getState();

    // Pollue d'abord avec quelques messages / outils
    store.appendUserMessage("hello");
    store.appendAssistantDelta("salut", "asst-1");
    store.addToolCall({ id: "tc-1", name: "search" });
    store.setRunState("error", "boom");

    // Puis reset pour nouveau run
    useChatStageStore.getState().resetForNewRun("run_abc");

    const after = useChatStageStore.getState();
    expect(after.messages).toEqual([]);
    expect(after.toolCalls).toEqual([]);
    expect(after.runState).toBe("streaming");
    expect(after.runError).toBeUndefined();
    expect(after.tokenEstimate).toBeUndefined();
  });

  it("appendAssistantDelta accumule les deltas successifs sur le même messageId", () => {
    const { appendAssistantDelta } = useChatStageStore.getState();
    appendAssistantDelta("Bon", "asst-1");
    appendAssistantDelta("jour", "asst-1");

    const msgs = useChatStageStore.getState().messages;
    expect(msgs).toHaveLength(1);
    expect(msgs[0].id).toBe("asst-1");
    expect(msgs[0].role).toBe("assistant");
    expect(msgs[0].content).toBe("Bonjour");
    expect(msgs[0].isStreaming).toBe(true);
  });

  it("addToolCall + updateToolCall fait passer un tool call pending → running → done", () => {
    const { addToolCall, updateToolCall } = useChatStageStore.getState();

    addToolCall({ id: "tc-1", name: "search", input: { query: "btc" } });
    let tc = useChatStageStore.getState().toolCalls[0];
    expect(tc.state).toBe("pending");
    expect(tc.name).toBe("search");
    expect(tc.startedAt).toBeGreaterThan(0);

    updateToolCall("tc-1", { state: "running" });
    tc = useChatStageStore.getState().toolCalls[0];
    expect(tc.state).toBe("running");

    updateToolCall("tc-1", { state: "done", output: { result: 42 }, endedAt: Date.now() });
    tc = useChatStageStore.getState().toolCalls[0];
    expect(tc.state).toBe("done");
    expect(tc.output).toEqual({ result: 42 });
    expect(tc.endedAt).toBeGreaterThan(0);
  });

  it("setRunState('error', msg) set runState ET runError", () => {
    useChatStageStore.getState().setRunState("error", "rate limited");
    const state = useChatStageStore.getState();
    expect(state.runState).toBe("error");
    expect(state.runError).toBe("rate limited");
  });
});
