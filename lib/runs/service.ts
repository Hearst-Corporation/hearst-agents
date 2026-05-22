/**
 * lib/runs/service.ts
 *
 * Service-level grouping for runs, derived from kind + metadata.
 * No DB migration required — mapping is pure client-side logic.
 */

export type RunService = "swarms" | "action" | "helm" | "jobs" | "other";

export const RUN_SERVICES: RunService[] = ["swarms", "action", "helm", "jobs", "other"];

/**
 * Derive a RunService from a run's kind and optional metadata.
 *
 * Rules (evaluated in order):
 *  - "swarm"                                       → "swarms"
 *  - "computer_action"                             → "action"
 *  - "tool_test" + event_id starts with
 *    "computer-action"                             → "action"
 *  - "image_gen"|"audio_gen"|"video_gen"|
 *    "doc_parse"|"code_exec"                       → "jobs"
 *  - "chat"|"workflow"|"evaluation"                → "helm"
 *  - anything else                                 → "other"
 */
export function runServiceFromKind(
  kind: string,
  metadata?: Record<string, unknown> | null,
): RunService {
  if (kind === "swarm") return "swarms";

  if (kind === "computer_action") return "action";

  if (kind === "tool_test") {
    const eventId = String(metadata?.event_id ?? "");
    if (eventId.startsWith("computer-action")) return "action";
  }

  if (
    kind === "image_gen" ||
    kind === "audio_gen" ||
    kind === "video_gen" ||
    kind === "doc_parse" ||
    kind === "code_exec"
  )
    return "jobs";

  if (kind === "chat" || kind === "workflow" || kind === "evaluation") return "helm";

  return "other";
}

/**
 * Return the DB kind values that *may* belong to the given service.
 *
 * Used to build a SQL `.in("kind", ...)` filter before JS-level refinement.
 * Note: "action" returns both "computer_action" and "tool_test" because
 * tool_test rows need the metadata check to distinguish real tool_tests
 * from computer-action placeholders.
 */
export function kindsForService(service: RunService): string[] {
  switch (service) {
    case "swarms":
      return ["swarm"];
    case "action":
      return ["computer_action", "tool_test"];
    case "jobs":
      return ["image_gen", "audio_gen", "video_gen", "doc_parse", "code_exec"];
    case "helm":
      return ["chat", "workflow", "evaluation"];
    case "other":
      return ["tool_test"];
  }
}

/**
 * JS-level refinement helper — filters rows to those whose derived service
 * matches `service`. Returns all rows when `service` is null/undefined.
 *
 * Generic so both route.ts and admin page.tsx can reuse it without
 * duplicating the filter logic.
 */
export function refineRunsByService<T>(
  rows: T[],
  service: RunService | null | undefined,
  kindOf: (row: T) => string,
  metadataOf: (row: T) => Record<string, unknown> | null | undefined,
): T[] {
  if (!service) return rows;
  return rows.filter((r) => runServiceFromKind(kindOf(r), metadataOf(r)) === service);
}
