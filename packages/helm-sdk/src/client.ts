import type {
  ChatInput,
  ChatResult,
  HelmClient,
  HelmClientOptions,
  MemoryResult,
  MemorySearchInput,
  Run,
  RunsListOptions,
  SwarmKickoffInput,
  SwarmKickoffResult,
} from "./types.js";

// ─── SSE parsing ─────────────────────────────────────────────────────────────

/**
 * Parse a raw SSE chunk buffer.
 * Returns an array of parsed JSON payloads (one per `data:` line).
 * Handles: "data: {...}", "data:{...}", blank lines between events, partial
 * chunks that don't end on a newline boundary (ignored — caller must buffer).
 */
function parseSseChunk(raw: string): unknown[] {
  const results: unknown[] = [];
  const lines = raw.split("\n");
  for (const line of lines) {
    const trimmed = line.trimEnd();
    if (!trimmed.startsWith("data:")) continue;
    // strip "data:" + optional single space
    const payload = trimmed.slice(5).replace(/^ /, "");
    if (!payload || payload === "[DONE]") continue;
    try {
      results.push(JSON.parse(payload));
    } catch {
      // partial / malformed — skip
    }
  }
  return results;
}

// ─── HTTP helpers ────────────────────────────────────────────────────────────

async function doFetch(
  url: string,
  options: RequestInit & { timeoutMs?: number },
): Promise<Response> {
  const { timeoutMs, ...init } = options;

  let signal: AbortSignal | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  if (timeoutMs != null && timeoutMs > 0) {
    const controller = new AbortController();
    signal = controller.signal;
    timer = setTimeout(() => controller.abort(), timeoutMs);
  }

  try {
    const res = await fetch(url, { ...init, signal });
    return res;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Helm SDK: request timed out after ${timeoutMs}ms`);
    }
    throw new Error(
      `Helm SDK: network error — ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    if (timer != null) clearTimeout(timer);
  }
}

async function assertOk(res: Response): Promise<void> {
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.text();
      detail = body ? ` — ${body.slice(0, 200)}` : "";
    } catch {
      // ignore
    }
    throw new Error(`Helm SDK: HTTP ${res.status} ${res.statusText}${detail}`);
  }
}

// ─── createHelmClient ─────────────────────────────────────────────────────────

export function createHelmClient(opts: HelmClientOptions): HelmClient {
  if (!opts.apiKey || !opts.apiKey.startsWith("hsk_")) {
    throw new Error('Helm SDK: apiKey is required and must start with "hsk_"');
  }

  const baseUrl = (opts.baseUrl ?? "https://hearst-os.vercel.app").replace(/\/$/, "");
  const defaultTimeout = opts.timeout ?? 30_000;

  function authHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  // ── chat ───────────────────────────────────────────────────────────────────

  async function chat(input: ChatInput, onDelta?: (text: string) => void): Promise<ChatResult> {
    const res = await doFetch(`${baseUrl}/api/v1/chat`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(input),
      // streaming — no timeout applied at fetch level
    });

    await assertOk(res);

    if (!res.body) {
      throw new Error("Helm SDK: chat response has no body");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = "";
    let runId: string | undefined;
    let buffer = ""; // partial SSE lines

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // We parse everything up to the last newline, keep the rest buffered.
      const lastNl = buffer.lastIndexOf("\n");
      if (lastNl === -1) continue; // wait for more data

      const chunk = buffer.slice(0, lastNl + 1);
      buffer = buffer.slice(lastNl + 1);

      const events = parseSseChunk(chunk);

      for (const evt of events) {
        if (typeof evt !== "object" || evt === null) continue;
        const e = evt as Record<string, unknown>;

        if (e.type === "text_delta") {
          const delta = typeof e.delta === "string" ? e.delta : "";
          accumulated += delta;
          onDelta?.(delta);
          continue;
        }

        if (e.type === "run_completed") {
          if (typeof e.runId === "string") runId = e.runId;
          return { text: accumulated, runId };
        }

        if (e.type === "run_failed") {
          const msg = typeof e.error === "string" ? e.error : "run failed";
          throw new Error(`Helm SDK: ${msg}`);
        }
      }
    }

    // Stream ended without run_completed — return what we have
    return { text: accumulated, runId };
  }

  // ── swarm ──────────────────────────────────────────────────────────────────

  const swarm = {
    async kickoff(input: SwarmKickoffInput): Promise<SwarmKickoffResult> {
      const res = await doFetch(`${baseUrl}/api/v1/swarms/kickoff`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(input),
        timeoutMs: defaultTimeout,
      });
      await assertOk(res);
      return res.json() as Promise<SwarmKickoffResult>;
    },

    async status(runId: string): Promise<Run> {
      const res = await doFetch(`${baseUrl}/api/v1/runs/${encodeURIComponent(runId)}`, {
        method: "GET",
        headers: authHeaders(),
        timeoutMs: defaultTimeout,
      });
      await assertOk(res);
      const body = (await res.json()) as { run: Run };
      return body.run;
    },
  };

  // ── memory ─────────────────────────────────────────────────────────────────

  const memory = {
    async search(input: MemorySearchInput): Promise<MemoryResult[]> {
      const res = await doFetch(`${baseUrl}/api/v1/memory/search`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(input),
        timeoutMs: defaultTimeout,
      });
      await assertOk(res);
      const body = (await res.json()) as { results: MemoryResult[] };
      return body.results;
    },
  };

  // ── runs ───────────────────────────────────────────────────────────────────

  const runs = {
    async list(opts?: RunsListOptions): Promise<Run[]> {
      const params = new URLSearchParams();
      if (opts?.limit != null) params.set("limit", String(opts.limit));
      if (opts?.kind) params.set("kind", opts.kind);
      const qs = params.size > 0 ? `?${params.toString()}` : "";

      const res = await doFetch(`${baseUrl}/api/v1/runs${qs}`, {
        method: "GET",
        headers: authHeaders(),
        timeoutMs: defaultTimeout,
      });
      await assertOk(res);
      const body = (await res.json()) as { runs: Run[] };
      return body.runs;
    },

    async get(id: string): Promise<Run | null> {
      const res = await doFetch(`${baseUrl}/api/v1/runs/${encodeURIComponent(id)}`, {
        method: "GET",
        headers: authHeaders(),
        timeoutMs: defaultTimeout,
      });
      if (res.status === 404) return null;
      await assertOk(res);
      const body = (await res.json()) as { run: Run };
      return body.run;
    },
  };

  return { chat, swarm, memory, runs };
}
