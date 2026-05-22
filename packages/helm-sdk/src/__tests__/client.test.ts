import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHelmClient } from "../client.js";

// ─── SSE helpers ─────────────────────────────────────────────────────────────

function sseLines(...events: object[]): string {
  return events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");
}

function makeStreamResponse(body: string, status = 200): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(body));
      controller.close();
    },
  });
  return new Response(stream, { status });
}

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ─── Setup ───────────────────────────────────────────────────────────────────

const VALID_KEY = "hsk_test_abc123";

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("createHelmClient", () => {
  it("throws when apiKey is missing", () => {
    expect(() => createHelmClient({ apiKey: "" })).toThrowError(/apiKey/);
  });

  it("throws when apiKey does not start with hsk_", () => {
    expect(() => createHelmClient({ apiKey: "wrong_key" })).toThrowError(/hsk_/);
  });

  it("creates a client successfully with valid key", () => {
    const client = createHelmClient({ apiKey: VALID_KEY });
    expect(client).toHaveProperty("chat");
    expect(client).toHaveProperty("swarm");
    expect(client).toHaveProperty("memory");
    expect(client).toHaveProperty("runs");
  });
});

// ─── chat ─────────────────────────────────────────────────────────────────────

describe("chat", () => {
  it("parses SSE stream and accumulates text_delta events", async () => {
    const sseBody = sseLines(
      { type: "text_delta", delta: "Hello" },
      { type: "text_delta", delta: ", world" },
      { type: "run_completed", runId: "run_42" },
    );

    fetchMock.mockResolvedValueOnce(makeStreamResponse(sseBody));

    const client = createHelmClient({ apiKey: VALID_KEY });
    const deltas: string[] = [];
    const result = await client.chat({ message: "hi" }, (d) => deltas.push(d));

    expect(result.text).toBe("Hello, world");
    expect(result.runId).toBe("run_42");
    expect(deltas).toEqual(["Hello", ", world"]);

    // Verify correct endpoint + headers
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/chat");
    expect((init.headers as Record<string, string>)["Authorization"]).toBe(`Bearer ${VALID_KEY}`);
  });

  it("rejects with a clear error on run_failed", async () => {
    const sseBody = sseLines(
      { type: "text_delta", delta: "partial..." },
      { type: "run_failed", error: "Agent crashed" },
    );

    fetchMock.mockResolvedValueOnce(makeStreamResponse(sseBody));

    const client = createHelmClient({ apiKey: VALID_KEY });
    await expect(client.chat({ message: "fail" })).rejects.toThrow(/Agent crashed/);
  });

  it("handles SSE with no space after data:", async () => {
    const rawSse = `data:{"type":"text_delta","delta":"compact"}\n\ndata:{"type":"run_completed"}\n\n`;
    fetchMock.mockResolvedValueOnce(makeStreamResponse(rawSse));

    const client = createHelmClient({ apiKey: VALID_KEY });
    const result = await client.chat({ message: "compact" });
    expect(result.text).toBe("compact");
  });

  it("throws on non-ok HTTP status", async () => {
    fetchMock.mockResolvedValueOnce(new Response("Unauthorized", { status: 401 }));

    const client = createHelmClient({ apiKey: VALID_KEY });
    await expect(client.chat({ message: "x" })).rejects.toThrow(/HTTP 401/);
  });
});

// ─── swarm.kickoff ────────────────────────────────────────────────────────────

describe("swarm.kickoff", () => {
  it("returns runId, swarmName, status from 202 response", async () => {
    const payload = {
      runId: "run_sw_001",
      swarmName: "market-analysis",
      status: "pending",
    };
    fetchMock.mockResolvedValueOnce(makeJsonResponse(payload, 202));

    const client = createHelmClient({ apiKey: VALID_KEY });
    const result = await client.swarm.kickoff({
      swarmId: "market-analysis",
      context: { ticker: "AAPL" },
    });

    expect(result.runId).toBe("run_sw_001");
    expect(result.swarmName).toBe("market-analysis");
    expect(result.status).toBe("pending");

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("/api/v1/swarms/kickoff");
  });
});

// ─── memory.search ────────────────────────────────────────────────────────────

describe("memory.search", () => {
  it("maps the results array", async () => {
    const payload = {
      results: [
        {
          sourceId: "note_001",
          textExcerpt: "Helm is an orchestrator",
          similarity: 0.92,
          metadata: { source: "vault" },
        },
        {
          sourceId: "note_002",
          textExcerpt: "Cortex stores long-term memory",
          similarity: 0.87,
          metadata: {},
        },
      ],
    };
    fetchMock.mockResolvedValueOnce(makeJsonResponse(payload));

    const client = createHelmClient({ apiKey: VALID_KEY });
    const results = await client.memory.search({ query: "helm memory" });

    expect(results).toHaveLength(2);
    expect(results[0].sourceId).toBe("note_001");
    expect(results[0].similarity).toBe(0.92);
    expect(results[1].textExcerpt).toBe("Cortex stores long-term memory");

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("/api/v1/memory/search");
  });
});

// ─── runs.get ─────────────────────────────────────────────────────────────────

describe("runs.get", () => {
  it("returns the run on 200", async () => {
    const run = {
      id: "run_xyz",
      kind: "swarm",
      status: "completed",
      createdAt: "2026-05-22T00:00:00Z",
    };
    fetchMock.mockResolvedValueOnce(makeJsonResponse({ run }));

    const client = createHelmClient({ apiKey: VALID_KEY });
    const result = await client.runs.get("run_xyz");
    expect(result).not.toBeNull();
    expect(result?.id).toBe("run_xyz");
  });

  it("returns null on 404", async () => {
    fetchMock.mockResolvedValueOnce(new Response("Not found", { status: 404 }));

    const client = createHelmClient({ apiKey: VALID_KEY });
    const result = await client.runs.get("nonexistent");
    expect(result).toBeNull();
  });
});

// ─── runs.list ────────────────────────────────────────────────────────────────

describe("runs.list", () => {
  it("passes query params and returns runs array", async () => {
    const runs = [
      { id: "r1", kind: "swarm", status: "completed", createdAt: "2026-05-22T00:00:00Z" },
      { id: "r2", kind: "swarm", status: "pending", createdAt: "2026-05-22T01:00:00Z" },
    ];
    fetchMock.mockResolvedValueOnce(makeJsonResponse({ runs }));

    const client = createHelmClient({ apiKey: VALID_KEY });
    const result = await client.runs.list({ limit: 5, kind: "swarm" });

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("r1");

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("limit=5");
    expect(url).toContain("kind=swarm");
  });
});
