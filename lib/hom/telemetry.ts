/**
 * Telemetry HOM — spans, logs, metrics au format JSONL.
 * Compatible OpenTelemetry sur la forme (trace_id, span_id, parent_span_id).
 * Stockage strictement file-based, aucun service externe.
 */
import path from "node:path";
import { HOM, todayUtc } from "./paths";
import {
  appendJsonl,
  appendText,
  nowIso,
  shortId,
  ensureDir,
} from "./fs-utils";
import type {
  AgentId,
  LogEvent,
  RunPhase,
  Span,
} from "./types";

export interface SpanRecorder {
  span: Span;
  end(opts?: {
    status?: "ok" | "error" | "cancelled";
    attributes?: Record<string, string | number | boolean | null>;
  }): Promise<Span>;
  log(level: LogEvent["level"], msg: string, context?: Record<string, unknown>): Promise<void>;
  child(name: string, opts?: {
    agent_id?: AgentId | "master";
    phase?: RunPhase;
    attributes?: Span["attributes"];
  }): SpanRecorder;
}

interface SpanOpts {
  trace_id: string;
  parent_span_id?: string | null;
  delegation_chain_id?: string | null;
  correlation_id: string;
  agent_id: AgentId | "master";
  phase: RunPhase;
  name: string;
  attributes?: Span["attributes"];
}

export function startSpan(opts: SpanOpts): SpanRecorder {
  const span: Span = {
    trace_id: opts.trace_id,
    span_id: shortId("s"),
    parent_span_id: opts.parent_span_id ?? null,
    delegation_chain_id: opts.delegation_chain_id ?? null,
    correlation_id: opts.correlation_id,
    agent_id: opts.agent_id,
    phase: opts.phase,
    name: opts.name,
    start_ts: nowIso(),
    end_ts: null,
    status: "ok",
    attributes: opts.attributes ?? {},
  };
  return makeRecorder(span);
}

function makeRecorder(span: Span): SpanRecorder {
  return {
    span,
    async end(o) {
      span.end_ts = nowIso();
      span.status = o?.status ?? "ok";
      if (o?.attributes) Object.assign(span.attributes, o.attributes);
      await persistSpan(span);
      return span;
    },
    async log(level, msg, context) {
      await writeLog({
        ts: nowIso(),
        level,
        trace_id: span.trace_id,
        span_id: span.span_id,
        agent_id: span.agent_id,
        msg,
        context,
      });
    },
    child(name, o) {
      return startSpan({
        trace_id: span.trace_id,
        parent_span_id: span.span_id,
        delegation_chain_id: span.delegation_chain_id,
        correlation_id: span.correlation_id,
        agent_id: o?.agent_id ?? span.agent_id,
        phase: o?.phase ?? span.phase,
        name,
        attributes: o?.attributes,
      });
    },
  };
}

async function persistSpan(span: Span): Promise<void> {
  const day = todayUtc();
  const file = path.join(HOM.traces, day, `${span.trace_id}.jsonl`);
  await appendJsonl(file, span);
  await appendJsonl(path.join(HOM.runs, span.trace_id, "spans.jsonl"), span);
}

export async function writeLog(event: LogEvent): Promise<void> {
  const day = todayUtc();
  const file = path.join(HOM.logs, day, `${event.agent_id}.jsonl`);
  await appendJsonl(file, event);
  if (event.trace_id !== "no-trace") {
    await appendText(
      path.join(HOM.runs, event.trace_id, "events.log"),
      `${event.ts} [${event.level}] ${event.agent_id} ${event.span_id} ${event.msg}\n`,
    );
  }
}

export async function ensureTelemetryDirs(): Promise<void> {
  const day = todayUtc();
  await ensureDir(path.join(HOM.traces, day));
  await ensureDir(path.join(HOM.logs, day));
  await ensureDir(HOM.metrics);
}

/** Lecteur léger pour exposer les spans d'un run dans l'UI. */
export async function readRunSpans(runId: string): Promise<Span[]> {
  const fs = await import("node:fs/promises");
  try {
    const raw = await fs.readFile(
      path.join(HOM.runs, runId, "spans.jsonl"),
      "utf8",
    );
    return raw
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Span);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

export async function readDayLogs(day: string, agent: string): Promise<LogEvent[]> {
  const fs = await import("node:fs/promises");
  try {
    const raw = await fs.readFile(
      path.join(HOM.logs, day, `${agent}.jsonl`),
      "utf8",
    );
    return raw
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as LogEvent);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}
