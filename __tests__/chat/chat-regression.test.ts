/**
 * chat-regression — tests de régression pour bugs critiques du chat.
 *
 * I-10 : ChatActionReceipts utilise lastRunId (pas currentRunId).
 * I-12 : dedup par stepId — un seul entry par step, avec latencyMs du completed.
 * I-16 : history clipping — seuls les 10 derniers messages sont passés à orchestrate.
 */

import { describe, expect, it } from "vitest";
import {
  reduceToolEvents,
  selectCompletedWrites,
} from "@/app/(user)/components/chat-tool-stream-reducer";
import type { StreamEvent } from "@/stores/runtime";

// ── Helper : fabriquer un StreamEvent minimal ─────────────────────────────────

function makeStartedEvent(
  runId: string,
  stepId: string,
  tool: string,
  ts = Date.now(),
): StreamEvent {
  return {
    type: "tool_call_started",
    run_id: runId,
    step_id: stepId,
    tool,
    timestamp: ts,
  };
}

function makeCompletedEvent(
  runId: string,
  stepId: string,
  tool: string,
  latencyMs?: number,
  ts = Date.now(),
): StreamEvent {
  return {
    type: "tool_call_completed",
    run_id: runId,
    step_id: stepId,
    tool,
    latencyMs,
    timestamp: ts,
  };
}

// ── I-10 : ChatActionReceipts — lastRunId, pas currentRunId ──────────────────

describe("I-10 — selectCompletedWrites utilise lastRunId", () => {
  // Le runtime store prepend (newest first) → index 0 = plus récent.
  // reduceToolEvents itère de length-1 vers 0 = oldest-first.
  // Donc: [completed (newest, idx 0), started (oldest, idx 1)]
  const events: StreamEvent[] = [
    makeCompletedEvent("run-1", "s1", "gmail_send_email", 320, 1320),
    makeStartedEvent("run-1", "s1", "gmail_send_email", 1000),
  ];

  it("retourne les write events quand runId = 'run-1' (lastRunId)", () => {
    const writes = selectCompletedWrites(events, "run-1");
    expect(writes).toHaveLength(1);
    expect(writes[0].stepId).toBe("s1");
    expect(writes[0].status).toBe("completed");
    expect(writes[0].kind).toBe("write");
  });

  it("retourne [] quand runId = null (currentRunId null = pas de receipts)", () => {
    // Simule l'état « run en cours » : currentRunId est utilisé pour les
    // tool-call live, mais les receipts doivent attendre lastRunId.
    const writes = selectCompletedWrites(events, null);
    expect(writes).toEqual([]);
  });

  it("retourne [] pour un runId qui ne correspond à aucun event", () => {
    const writes = selectCompletedWrites(events, "run-99");
    expect(writes).toEqual([]);
  });

  it("ignore les write events d'un run différent", () => {
    const mixedEvents: StreamEvent[] = [
      // run-2 en tête (plus récent)
      makeCompletedEvent("run-2", "s2", "gmail_send_email", 400, 2400),
      makeStartedEvent("run-2", "s2", "gmail_send_email", 2000),
      // run-1 en queue (plus ancien)
      makeCompletedEvent("run-1", "s1", "gmail_send_email", 320, 1320),
      makeStartedEvent("run-1", "s1", "gmail_send_email", 1000),
    ];
    // Seul run-1 doit remonter
    const writes = selectCompletedWrites(mixedEvents, "run-1");
    expect(writes).toHaveLength(1);
    expect(writes[0].stepId).toBe("s1");
  });
});

// ── I-12 : dedup par stepId ───────────────────────────────────────────────────

describe("I-12 — reduceToolEvents dedup par stepId", () => {
  // Rappel : events store = newest-first (prepend). L'itérateur va de
  // length-1 → 0, donc oldest-first. Pour déduper correctement :
  //   [completed (newest, idx 0), started (oldest, idx 1)]

  it("tool_call_started + tool_call_completed (même stepId) → 1 seul entry", () => {
    const events: StreamEvent[] = [
      makeCompletedEvent("run-1", "s1", "google.gmail.list_recent_messages", 500, 1500),
      makeStartedEvent("run-1", "s1", "google.gmail.list_recent_messages", 1000),
    ];

    const entries = reduceToolEvents(events, "run-1");
    expect(entries).toHaveLength(1);
  });

  it("l'entry dédupliqué porte le latencyMs de l'event completed", () => {
    const events: StreamEvent[] = [
      makeCompletedEvent("run-1", "s1", "google.gmail.list_recent_messages", 500, 1500),
      makeStartedEvent("run-1", "s1", "google.gmail.list_recent_messages", 1000),
    ];

    const entries = reduceToolEvents(events, "run-1");
    expect(entries[0].latencyMs).toBe(500);
  });

  it("l'entry dédupliqué a status = 'completed'", () => {
    const events: StreamEvent[] = [
      makeCompletedEvent("run-1", "s1", "google.gmail.list_recent_messages", 500, 1500),
      makeStartedEvent("run-1", "s1", "google.gmail.list_recent_messages", 1000),
    ];

    const entries = reduceToolEvents(events, "run-1");
    expect(entries[0].status).toBe("completed");
  });

  it("deux steps différents → 2 entries distincts", () => {
    // Newest first : s2-completed, s2-started, s1-completed, s1-started
    const events: StreamEvent[] = [
      makeCompletedEvent("run-1", "s2", "gmail_send_email", 150, 1450),
      makeStartedEvent("run-1", "s2", "gmail_send_email", 1300),
      makeCompletedEvent("run-1", "s1", "google.gmail.list_recent_messages", 200, 1200),
      makeStartedEvent("run-1", "s1", "google.gmail.list_recent_messages", 1000),
    ];

    const entries = reduceToolEvents(events, "run-1");
    expect(entries).toHaveLength(2);
  });

  it("un step uniquement started (pas encore completed) → status = 'running'", () => {
    const events: StreamEvent[] = [
      makeStartedEvent("run-1", "s1", "google.gmail.list_recent_messages", 1000),
    ];

    const entries = reduceToolEvents(events, "run-1");
    expect(entries).toHaveLength(1);
    expect(entries[0].status).toBe("running");
    expect(entries[0].latencyMs).toBeUndefined();
  });
});

// ── I-16 : history clipping — 10 derniers messages passés à orchestrate ───────

describe("I-16 — history clipping : 10 derniers messages max", () => {
  /**
   * ChatDock clippe l'historique avec :
   *   messages.filter(...).slice(-10)
   *
   * On teste la logique de clipping directement (sans monter le composant
   * entier qui dépend de Next.js router, Zustand, fetch, etc.).
   */

  type SimpleMessage = { id: string; role: "user" | "assistant" | "system"; content: string };

  function buildHistory(count: number): SimpleMessage[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `msg-${i}`,
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `message ${i}`,
    }));
  }

  /** Réplique exacte de la logique ChatDock handleSubmit pour l'historique. */
  function clipHistory(messages: SimpleMessage[]): { role: string; content: string }[] {
    return messages
      .filter((m) => (m.role === "user" || m.role === "assistant") && m.content.trim().length > 0)
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }));
  }

  it("15 messages → clip à 10 (les 10 derniers)", () => {
    const msgs = buildHistory(15);
    const clipped = clipHistory(msgs);
    expect(clipped).toHaveLength(10);
    // Les 10 derniers : indices 5..14
    expect(clipped[0].content).toBe("message 5");
    expect(clipped[9].content).toBe("message 14");
  });

  it("5 messages → tous conservés (< 10)", () => {
    const msgs = buildHistory(5);
    const clipped = clipHistory(msgs);
    expect(clipped).toHaveLength(5);
  });

  it("exactement 10 messages → tous conservés", () => {
    const msgs = buildHistory(10);
    const clipped = clipHistory(msgs);
    expect(clipped).toHaveLength(10);
  });

  it("messages vides (content = '') sont filtrés avant le clip", () => {
    const msgs: SimpleMessage[] = [
      ...buildHistory(8),
      { id: "empty-1", role: "user", content: "  " },
      { id: "empty-2", role: "assistant", content: "" },
      { id: "last", role: "user", content: "dernier message visible" },
    ];
    const clipped = clipHistory(msgs);
    // Les 2 messages vides sont supprimés, donc 9 messages valides → tous conservés
    expect(clipped.every((m) => m.content.trim().length > 0)).toBe(true);
    expect(clipped[clipped.length - 1].content).toBe("dernier message visible");
  });

  it("messages system sont exclus du clip (filtre role)", () => {
    const msgs: SimpleMessage[] = [
      { id: "sys", role: "system", content: "system prompt" },
      ...buildHistory(5),
    ];
    const clipped = clipHistory(msgs);
    expect(clipped.every((m) => m.role !== "system")).toBe(true);
  });
});
