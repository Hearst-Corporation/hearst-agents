import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { toolsGet, toolsExecute, connectedAccountsList } = vi.hoisted(() => ({
  toolsGet: vi.fn(),
  toolsExecute: vi.fn(),
  connectedAccountsList: vi.fn(),
}));

vi.mock("@composio/core", () => {
  class Composio {
    tools = { get: toolsGet, execute: toolsExecute };
    toolkits = { list: vi.fn(), get: vi.fn(), authorize: vi.fn() };
    connectedAccounts = { list: connectedAccountsList, delete: vi.fn() };
    create = vi.fn();
  }
  return { Composio };
});

// Helper: pre-stub connectedAccounts.list to return ACTIVE accounts for the
// toolkits we expect tools.get to be queried for. Without this, the new
// cross-check short-circuits at "no ACTIVE toolkits" and returns [].
function stubActiveAccounts(slugs: string[]): void {
  connectedAccountsList.mockResolvedValue({
    items: slugs.map((slug, i) => ({
      id: `acc-${i}`,
      toolkit: { slug },
      status: "ACTIVE",
    })),
  });
}

import {
  getToolsForUser,
  invalidateUserDiscovery,
  resetComposioClient,
  resetDiscoveryCache,
  toAnthropicTools,
  toOpenAITools,
} from "@/lib/connectors/composio";

// SDK v0.6 returns OpenAI-style tool descriptors:
// { type: 'function', function: { name, description, parameters } }
const sampleGmail = {
  type: "function",
  function: {
    name: "GMAIL_SEND_EMAIL",
    description: "Send an email",
    parameters: { type: "object", properties: { to: { type: "string" } } },
  },
};

const sampleSlack = {
  type: "function",
  function: {
    name: "SLACKBOT_SEND_MESSAGE",
    description: "Send a Slack message",
    parameters: { type: "object", properties: {} },
  },
};

describe("Composio discovery (new SDK)", () => {
  beforeEach(() => {
    resetDiscoveryCache();
    resetComposioClient();
    toolsGet.mockReset();
    connectedAccountsList.mockReset();
    process.env.COMPOSIO_API_KEY = "ak_test";
  });
  afterEach(() => {
    delete process.env.COMPOSIO_API_KEY;
    resetDiscoveryCache();
    resetComposioClient();
  });

  it("returns [] without hitting the SDK when userId is empty", async () => {
    const out = await getToolsForUser("");
    expect(out).toEqual([]);
    expect(toolsGet).not.toHaveBeenCalled();
  });

  it("forwards { userId } to the SDK so multi-tenant isolation is preserved", async () => {
    stubActiveAccounts(["gmail"]);
    // Use mockResolvedValue (not Once) so both parallel calls (general + essential)
    // receive a valid response.
    toolsGet.mockResolvedValue({ items: [sampleGmail] });
    await getToolsForUser("user-marie");

    expect(toolsGet).toHaveBeenCalledWith("user-marie", expect.any(Object));
  });

  it("normalizes raw tools into DiscoveredTool with derived app slug", async () => {
    stubActiveAccounts(["gmail", "slackbot"]);
    // Use per-call mock (robust against parallel execution order):
    // gmail general → sampleGmail, slackbot general → sampleSlack,
    // gmail essential fetch (tools:[...]) → empty (dedup handles it)
    toolsGet.mockImplementation((_userId: string, params: Record<string, unknown>) => {
      if (Array.isArray(params.toolkits)) {
        if ((params.toolkits as string[]).includes("gmail"))
          return Promise.resolve({ items: [sampleGmail] });
        if ((params.toolkits as string[]).includes("slackbot"))
          return Promise.resolve({ items: [sampleSlack] });
      }
      return Promise.resolve({ items: [] }); // essential fetches → empty
    });
    const out = await getToolsForUser("u1");
    expect(out).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "GMAIL_SEND_EMAIL", app: "gmail" }),
        expect.objectContaining({ name: "SLACKBOT_SEND_MESSAGE", app: "slackbot" }),
      ]),
    );
  });

  it("caches per-user — second call within TTL doesn't hit the SDK", async () => {
    // gmail has ESSENTIAL_READS → 2 calls on first fetch (general + essential),
    // then 0 on second fetch (cache hit). Total = 2 (not 1).
    stubActiveAccounts(["gmail"]);
    toolsGet.mockResolvedValue({ items: [sampleGmail] });
    await getToolsForUser("u1");
    await getToolsForUser("u1"); // cache hit — no additional SDK calls
    // 2 = 1 general + 1 essential (first fetch only; second is cached)
    expect(toolsGet).toHaveBeenCalledTimes(2);
  });

  it("invalidateUserDiscovery forces a refetch", async () => {
    // First fetch: gmail only (general + essential in parallel = 2 SDK calls).
    stubActiveAccounts(["gmail"]);
    toolsGet.mockResolvedValue({ items: [sampleGmail] });
    await getToolsForUser("u1");
    expect(toolsGet).toHaveBeenCalledTimes(2); // gmail: general + essential

    invalidateUserDiscovery("u1");
    toolsGet.mockReset();

    // Second fetch: gmail + slackbot.
    // Per-call mock based on argument (robust against parallel execution order):
    //   toolkits:['gmail'] → sampleGmail
    //   toolkits:['slackbot'] → sampleSlack
    //   tools:[...gmail essentials] → sampleGmail (dedup will remove it, result unchanged)
    stubActiveAccounts(["gmail", "slackbot"]);
    toolsGet.mockImplementation((_userId: string, params: Record<string, unknown>) => {
      if (Array.isArray(params.toolkits)) {
        if ((params.toolkits as string[]).includes("gmail"))
          return Promise.resolve({ items: [sampleGmail] });
        if ((params.toolkits as string[]).includes("slackbot"))
          return Promise.resolve({ items: [sampleSlack] });
      }
      // Essential fetch for gmail (tools:[...slugs])
      if (Array.isArray(params.tools)) return Promise.resolve({ items: [] });
      return Promise.resolve({ items: [] });
    });

    const out = await getToolsForUser("u1");
    expect(out).toHaveLength(2);
    // Second fetch: gmail (general + essential) + slackbot (general only) = 3 calls.
    expect(toolsGet).toHaveBeenCalledTimes(3);
  });

  it("isolates cache between users", async () => {
    // u1 → gmail: general + essential (parallel) = 2 SDK calls.
    stubActiveAccounts(["gmail"]);
    toolsGet.mockResolvedValue({ items: [sampleGmail] });
    await getToolsForUser("u1");
    expect(toolsGet).toHaveBeenCalledTimes(2);

    // u2 → slackbot only (no ESSENTIAL_READS entry) = 1 SDK call.
    stubActiveAccounts(["slackbot"]);
    toolsGet.mockReset();
    toolsGet.mockResolvedValue({ items: [sampleSlack] });
    const out = await getToolsForUser("u2");
    expect(out[0].name).toBe("SLACKBOT_SEND_MESSAGE");
    // 1 call for u2 (slackbot: general only, no essential registry entry)
    expect(toolsGet).toHaveBeenCalledTimes(1);
  });

  it("returns [] without throwing when SDK throws", async () => {
    stubActiveAccounts(["gmail"]);
    // Use mockRejectedValue (not Once) so both the general and essential parallel
    // fetches reject — ensures neither leg masks the error via a resolved stub.
    toolsGet.mockRejectedValue(new Error("Composio rate-limit"));
    const out = await getToolsForUser("u1");
    expect(out).toEqual([]);
  });

  it("returns [] without hitting tools.get when the user has no ACTIVE accounts", async () => {
    connectedAccountsList.mockResolvedValueOnce({ items: [] });
    const out = await getToolsForUser("u1");
    expect(out).toEqual([]);
    expect(toolsGet).not.toHaveBeenCalled();
  });

  it("does NOT cache empty results — re-queries on the next call", async () => {
    // First call: no ACTIVE accounts (mid-OAuth, propagation lag).
    connectedAccountsList.mockResolvedValueOnce({ items: [] });
    const first = await getToolsForUser("u1");
    expect(first).toEqual([]);
    // Second call: connection finally registered.
    stubActiveAccounts(["slackbot"]);
    toolsGet.mockResolvedValueOnce({ items: [sampleSlack] });
    const second = await getToolsForUser("u1");
    expect(second).toHaveLength(1);
    // Both calls must hit the SDK — empty was not cached.
    expect(connectedAccountsList).toHaveBeenCalledTimes(2);
  });

  it("intersects opts.apps with ACTIVE accounts", async () => {
    stubActiveAccounts(["gmail", "slackbot"]);
    toolsGet.mockResolvedValueOnce({ items: [sampleSlack] });
    await getToolsForUser("u1", { apps: ["slackbot", "github"] });
    // tools.get should be called with only the intersection: slackbot (exact shape).
    expect(toolsGet).toHaveBeenCalledWith("u1", {
      toolkits: ["slackbot"],
      limit: expect.any(Number),
    });
  });

  it("converts to Anthropic tool format", () => {
    const out = toAnthropicTools([
      { name: "X", description: "desc", parameters: { type: "object" }, app: "x" },
    ]);
    expect(out[0]).toMatchObject({
      name: "X",
      description: "desc",
      input_schema: { type: "object" },
    });
  });

  it("converts to OpenAI function-calling format", () => {
    const out = toOpenAITools([
      { name: "X", description: "desc", parameters: { type: "object" }, app: "x" },
    ]);
    expect(out[0]).toMatchObject({
      type: "function",
      function: { name: "X", parameters: { type: "object" } },
    });
  });

  // ESSENTIAL READS MERGE: when the general {toolkits:[github]} call returns only
  // write/noise actions (simulating the case where key reads sit beyond the limit
  // at native indices 236-324), the second deterministic {tools:[...]} call must
  // inject the missing reads. The final result must contain GITHUB_GET_A_REPOSITORY.
  //
  // This test FAILS if the essential-reads fetch is removed or not merged, and
  // PASSES only when both fetches are done and deduped.
  it("essential reads survive when the general toolkit fetch returns only non-read actions", async () => {
    // Simulate github connected and ACTIVE.
    stubActiveAccounts(["github"]);

    // The essential read we want to guarantee is present.
    const essentialRead = {
      type: "function",
      function: {
        name: "GITHUB_GET_A_REPOSITORY",
        description: "Get a repository",
        parameters: { type: "object", properties: {} },
      },
    };

    // General fetch ({toolkits:['github'], limit:60}) returns only a write action —
    // simulates the real scenario where GITHUB_GET_A_REPOSITORY is at native index
    // 324 and therefore absent from the first 60 results.
    const generalWrite = {
      type: "function",
      function: {
        name: "GITHUB_CREATE_AN_ISSUE",
        description: "Create an issue",
        parameters: { type: "object", properties: {} },
      },
    };

    // Per-call mock (robust against parallel execution order):
    // toolkits:['github'] → generalWrite; tools:[...slugs] → essentialRead
    toolsGet.mockImplementation((_userId: string, params: Record<string, unknown>) => {
      if (Array.isArray(params.toolkits)) return Promise.resolve({ items: [generalWrite] });
      return Promise.resolve({ items: [essentialRead] }); // essential fetch (tools:[])
    });

    const out = await getToolsForUser("user-test-essential");

    const names = out.map((t) => t.name);
    // Write from general fetch must survive
    expect(names).toContain("GITHUB_CREATE_AN_ISSUE");
    // Essential read from the second fetch must also be present
    expect(names).toContain("GITHUB_GET_A_REPOSITORY");
    // No duplicates
    expect(names.filter((n) => n === "GITHUB_GET_A_REPOSITORY")).toHaveLength(1);
  });

  it("essential reads fetch failure is swallowed — general results still returned", async () => {
    stubActiveAccounts(["github"]);

    const generalWrite = {
      type: "function",
      function: {
        name: "GITHUB_CREATE_AN_ISSUE",
        description: "Create an issue",
        parameters: { type: "object", properties: {} },
      },
    };

    // Per-call mock: toolkits → success; tools (essential) → throws
    toolsGet.mockImplementation((_userId: string, params: Record<string, unknown>) => {
      if (Array.isArray(params.toolkits)) return Promise.resolve({ items: [generalWrite] });
      return Promise.reject(new Error("essential reads network error"));
    });

    // Should not throw, should return the general result
    const out = await getToolsForUser("user-test-essential-fail");
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("GITHUB_CREATE_AN_ISSUE");
  });

  it("essential reads dedup — if the read appears in both fetches, no duplicate in output", async () => {
    stubActiveAccounts(["github"]);

    const sharedTool = {
      type: "function",
      function: {
        name: "GITHUB_GET_A_REPOSITORY",
        description: "Get a repository",
        parameters: { type: "object", properties: {} },
      },
    };

    // Per-call mock: both general and essential return the same tool
    toolsGet.mockImplementation(() => Promise.resolve({ items: [sharedTool] }));

    const out = await getToolsForUser("user-test-dedup");
    const names = out.map((t) => t.name);
    // Must appear exactly once
    expect(names.filter((n) => n === "GITHUB_GET_A_REPOSITORY")).toHaveLength(1);
  });
});
