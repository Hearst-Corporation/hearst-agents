/**
 * SSE HITL Contract — frames réels produits par SSEAdapter pour les events
 * Human-In-The-Loop (approval / clarification) consommés par Hive
 * (POST /api/missions/{id}/resume).
 *
 * Prouve :
 *  - `run_id` + `decision.id` (approval_id) + `options[].kind` TOUJOURS présents.
 *  - `mission_id` présent SI résolvable (adapter construit avec missionId),
 *    ABSENT sinon (fail-open — jamais inventé).
 *  - Rétrocompat : `approval_id`, `step_id`, `question`, `options: string[]`
 *    restent présents.
 */

import { describe, expect, it } from "vitest";
import { RunEventBus } from "@/lib/events/bus";
import { SSEAdapter } from "@/lib/events/consumers/sse-adapter";

/** Capture les frames SSE `data: {...}` émis par l'adapter via un controller mock. */
function captureFrames(missionId?: string) {
  const bus = new RunEventBus();
  const adapter = new SSEAdapter(bus, missionId);
  const frames: Array<Record<string, unknown>> = [];
  const decoder = new TextDecoder();

  const controller = {
    enqueue(chunk: Uint8Array) {
      const text = decoder.decode(chunk);
      for (const line of text.split("\n\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        frames.push(JSON.parse(trimmed.slice("data: ".length)));
      }
    },
    close() {},
  } as unknown as ReadableStreamDefaultController;

  adapter.pipe(controller);
  return { bus, frames };
}

function frameOf(frames: Array<Record<string, unknown>>, type: string) {
  return frames.find((f) => f.type === type);
}

describe("SSE HITL contract — approval_requested", () => {
  it("émet run_id + approval_id + options[].kind ; mission_id absent (chat libre, fail-open)", () => {
    const { bus, frames } = captureFrames(/* no missionId */);
    bus.emit({
      type: "approval_requested",
      run_id: "run-1",
      step_id: "step-1",
      approval_id: "appr-1",
    });

    const f = frameOf(frames, "approval_requested");
    expect(f).toBeDefined();
    expect(f?.run_id).toBe("run-1");
    expect(f?.approval_id).toBe("appr-1"); // = decision.id côté Hive
    expect(f?.step_id).toBe("step-1");
    const options = f?.options as Array<{ id: string; label: string; kind: string }>;
    expect(Array.isArray(options)).toBe(true);
    expect(options.length).toBeGreaterThan(0);
    for (const opt of options) {
      expect(typeof opt.id).toBe("string");
      expect(typeof opt.label).toBe("string");
      expect(["confirm", "decline", "cancel", "other"]).toContain(opt.kind);
    }
    expect(options.some((o) => o.kind === "confirm")).toBe(true);
    expect(options.some((o) => o.kind === "decline")).toBe(true);
    // fail-open : pas de mission → pas de champ mission_id
    expect("mission_id" in (f as object)).toBe(false);
  });

  it("émet mission_id quand l'adapter est construit avec un missionId (run rattaché)", () => {
    const { bus, frames } = captureFrames("mission-42");
    bus.emit({
      type: "approval_requested",
      run_id: "run-2",
      step_id: "step-2",
      approval_id: "appr-2",
    });

    const f = frameOf(frames, "approval_requested");
    expect(f?.mission_id).toBe("mission-42");
  });

  it("préfère le mission_id porté par l'event s'il est stampé en amont", () => {
    const { bus, frames } = captureFrames("mission-adapter");
    bus.emit({
      type: "approval_requested",
      run_id: "run-3",
      step_id: "step-3",
      approval_id: "appr-3",
      mission_id: "mission-event",
    });
    expect(frameOf(frames, "approval_requested")?.mission_id).toBe("mission-event");
  });

  it("respecte des options custom fournies par l'engine", () => {
    const { bus, frames } = captureFrames();
    bus.emit({
      type: "approval_requested",
      run_id: "run-4",
      step_id: "step-4",
      approval_id: "appr-4",
      options: [
        { id: "x", label: "Annuler", kind: "cancel" },
        { id: "y", label: "OK", kind: "confirm" },
      ],
    });
    const options = frameOf(frames, "approval_requested")?.options as Array<{ kind: string }>;
    expect(options.map((o) => o.kind)).toEqual(["cancel", "confirm"]);
  });
});

describe("SSE HITL contract — clarification_requested", () => {
  it("préserve options: string[] (rétrocompat) ET ajoute option_choices[].kind", () => {
    const { bus, frames } = captureFrames();
    bus.emit({
      type: "clarification_requested",
      run_id: "run-5",
      question: "Quel canal ?",
      options: ["Slack", "Email"],
    });

    const f = frameOf(frames, "clarification_requested");
    expect(f?.run_id).toBe("run-5");
    expect(f?.question).toBe("Quel canal ?");
    // rétrocompat : options string[] intact
    expect(f?.options).toEqual(["Slack", "Email"]);
    // additif : forme sémantique
    const choices = f?.option_choices as Array<{ id: string; label: string; kind: string }>;
    expect(choices).toHaveLength(2);
    expect(choices[0]).toMatchObject({ label: "Slack", kind: "other" });
    expect(choices[1]).toMatchObject({ label: "Email", kind: "other" });
    // fail-open : pas de mission
    expect("mission_id" in (f as object)).toBe(false);
  });

  it("émet mission_id quand résolvable, et pas d'option_choices sans options", () => {
    const { bus, frames } = captureFrames("mission-77");
    bus.emit({
      type: "clarification_requested",
      run_id: "run-6",
      question: "Précise ?",
    });

    const f = frameOf(frames, "clarification_requested");
    expect(f?.mission_id).toBe("mission-77");
    expect(f?.question).toBe("Précise ?");
    expect("option_choices" in (f as object)).toBe(false);
  });
});

describe("SSE HITL contract — mission_run_request porte déjà mission_id", () => {
  it("expose mission_id (garanti)", () => {
    const { bus, frames } = captureFrames();
    bus.emit({
      type: "mission_run_request",
      run_id: "run-7",
      mission_id: "mission-9",
      mission_name: "Digest hebdo",
      match_kind: "exact",
    });
    const f = frameOf(frames, "mission_run_request");
    expect(f?.mission_id).toBe("mission-9");
    expect(f?.mission_name).toBe("Digest hebdo");
  });
});
