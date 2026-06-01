/**
 * Write Action Guard tests — covers the preview-gate detection,
 * preview formatter, and domain → app filter.
 */

import { describe, expect, it } from "vitest";
import type { DiscoveredTool } from "@/lib/connectors/composio/discovery";
import {
  filterToolsByDomain,
  formatActionPreview,
  isWriteAction,
  MAX_TOOLS,
} from "@/lib/connectors/composio/write-guard";

function tool(name: string, app: string, essential?: true): DiscoveredTool {
  return {
    name,
    app,
    description: name,
    parameters: { type: "object", properties: {} },
    ...(essential ? { essential: true } : {}),
  };
}

describe("isWriteAction", () => {
  it.each([
    // ── Core segment checks ───────────────────────────────────────────────
    ["GMAIL_SEND_EMAIL", true], // _SEND_
    ["SLACK_SEND_MESSAGE", true], // _SEND_
    ["NOTION_CREATE_PAGE", true], // _CREATE_
    ["HUBSPOT_DELETE_CONTACT", true], // _DELETE_
    ["GITHUB_UPDATE_FILE", true], // _UPDATE_
    ["GMAIL_REPLY_TO_EMAIL", true], // _REPLY_
    ["SLACK_ARCHIVE_CHANNEL", true], // _ARCHIVE_
    ["GITHUB_MOVE_FILE", true], // _MOVE_
    ["GITHUB_POST_COMMENT", true], // _POST_
    ["NOTION_PUBLISH_PAGE", true], // _PUBLISH_
    ["HUBSPOT_REMOVE_CONTACT", true], // _REMOVE_
    ["GITHUB_WRITE_FILE", true], // _WRITE_
    ["GITHUB_PATCH_GIST", true], // _PATCH_
    ["GITHUB_PUT_BRANCH_PROTECTION", true], // _PUT_
    ["JIRA_SUBMIT_FORM", true], // _SUBMIT_
    ["GMAIL_FORWARD_EMAIL", true], // _FORWARD_
    ["GMAIL_MARK_AS_READ", true], // _MARK_
    ["SLACK_UNSUBSCRIBE_FROM_CHANNEL", true], // _UNSUBSCRIBE_
    ["GITHUB_INVITE_COLLABORATOR", true], // _INVITE_
    // _ADD_ is a write — GITHUB_ADD_ASSIGNEES_TO_AN_ISSUE must be classified write
    ["GITHUB_ADD_ASSIGNEES_TO_AN_ISSUE", true],
    ["GITHUB_ADD_LABELS_TO_AN_ISSUE", true],
    ["SLACK_ADD_REACTION_TO_AN_ITEM", true],
    // ── Read actions (must not fire) ──────────────────────────────────────
    ["GMAIL_LIST_MESSAGES", false],
    ["SLACK_GET_CHANNEL_INFO", false],
    ["GITHUB_GET_REPO", false],
    ["GMAIL_SEARCH_EMAILS", false],
    ["NOTION_GET_PAGE", false],
    ["HUBSPOT_LIST_CONTACTS", false],
    ["GITHUB_GET_AN_ISSUE", false],
    ["GITHUB_FIND_PULL_REQUESTS", false],
    ["GITHUB_GET_A_REPOSITORY", false],
    // ── _ASSIGN_ boundary cases ───────────────────────────────────────────
    // Real write: _ASSIGN_ with no read prefix → write
    ["JIRA_ASSIGN_ISSUE", true],
    // Hypothetical: read-verb prefix before _ASSIGN_ → NOT a write
    ["GITHUB_GET_ASSIGNEES_LIST", false], // hypothetical GET_..._ASSIGN_
    ["GITHUB_LIST_ASSIGNEES_FOR_REPO", false], // hypothetical LIST_..._ASSIGN_
    // Composio-mangled: ASSIGNEES → ASSIGN_EES, producing LIST_ASSIGN_ directly.
    // Must be READ (LIST_ASSIGN_ is treated as read-prefix even with no
    // intermediate segment between LIST_ and ASSIGN_).
    ["GITHUB_ISSUES_LIST_ASSIGN_EES", false],
  ])("%s → %s", (name, expected) => {
    expect(isWriteAction(name)).toBe(expected);
  });

  it("matches WRITE_PREFIXES on tools that start with a write verb (no leading underscore)", () => {
    expect(isWriteAction("SEND_EMAIL")).toBe(true);
    expect(isWriteAction("CREATE_TASK")).toBe(true);
    expect(isWriteAction("DELETE_RECORD")).toBe(true);
    expect(isWriteAction("UPDATE_PROFILE")).toBe(true);
  });

  it("non-standard names without underscores fall through to false", () => {
    // No prefix match (no trailing underscore) and no segment match
    expect(isWriteAction("send")).toBe(false);
    expect(isWriteAction("SEND")).toBe(false);
  });
});

describe("formatActionPreview", () => {
  it("includes the lowercased app name (uppercased in header)", () => {
    const out = formatActionPreview("SLACK_SEND_MESSAGE", { channel: "#dev", text: "hello" });
    expect(out).toContain("SLACK");
  });

  it("contains 'confirmer' in the footer", () => {
    const out = formatActionPreview("GMAIL_SEND_EMAIL", { to: "a@b.com", subject: "hi" });
    expect(out.toLowerCase()).toContain("confirmer");
  });

  it("surfaces prominent params (to, channel, subject)", () => {
    const out = formatActionPreview("GMAIL_SEND_EMAIL", {
      to: "marie@example.com",
      subject: "Hello world",
      body: "Lorem ipsum",
    });
    expect(out).toContain("marie@example.com");
    expect(out).toContain("Hello world");
    expect(out).toContain("to");
    expect(out).toContain("subject");
  });

  it("filters out _preview from the rendered preview", () => {
    const out = formatActionPreview("SLACK_SEND_MESSAGE", {
      channel: "#dev",
      text: "msg",
      _preview: true,
    });
    expect(out).not.toContain("_preview");
  });

  it("truncates long string values past 300 chars", () => {
    const longText = "x".repeat(500);
    const out = formatActionPreview("SLACK_SEND_MESSAGE", { channel: "#dev", text: longText });
    expect(out).not.toContain("x".repeat(500));
    expect(out).toContain("…");
  });

  it("returns a valid preview when args is empty", () => {
    const out = formatActionPreview("SLACK_SEND_MESSAGE", {});
    expect(typeof out).toBe("string");
    expect(out.length).toBeGreaterThan(0);
    expect(out.toLowerCase()).toContain("confirmer");
    expect(out).toContain("aucun paramètre");
  });
});

describe("filterToolsByDomain", () => {
  const allTools: DiscoveredTool[] = [
    tool("GMAIL_SEND_EMAIL", "gmail"),
    tool("SLACK_SEND_MESSAGE", "slack"),
    tool("GITHUB_CREATE_ISSUE", "github"),
    tool("JIRA_CREATE_ISSUE", "jira"),
    tool("LINEAR_CREATE_ISSUE", "linear"),
    tool("NOTION_CREATE_PAGE", "notion"),
    tool("STRIPE_CREATE_CHARGE", "stripe"),
    tool("FIGMA_GET_FILE", "figma"),
  ];

  it("communication → only gmail + slack", () => {
    const out = filterToolsByDomain(allTools, "communication");
    const apps = out.map((t) => t.app);
    expect(apps).toEqual(expect.arrayContaining(["gmail", "slack"]));
    expect(apps).not.toContain("github");
    expect(apps).not.toContain("notion");
    expect(apps).not.toContain("stripe");
    expect(apps).not.toContain("figma");
  });

  it("developer → only github, jira, linear", () => {
    const out = filterToolsByDomain(allTools, "developer");
    const apps = out.map((t) => t.app);
    expect(apps.sort()).toEqual(["github", "jira", "linear"]);
  });

  it("finance → only stripe", () => {
    const out = filterToolsByDomain(allTools, "finance");
    expect(out.map((t) => t.app)).toEqual(["stripe"]);
  });

  it("design → only figma", () => {
    const out = filterToolsByDomain(allTools, "design");
    expect(out.map((t) => t.app)).toEqual(["figma"]);
  });

  it("general → all tools (≤ 40)", () => {
    const out = filterToolsByDomain(allTools, "general");
    expect(out).toHaveLength(allTools.length);
  });

  it("research → all tools (≤ 40)", () => {
    const out = filterToolsByDomain(allTools, "research");
    expect(out).toHaveLength(allTools.length);
  });

  it("caps general domain at 40 tools", () => {
    const fifty = Array.from({ length: 50 }, (_, i) => tool(`GENERIC_TOOL_${i}`, "gmail"));
    const out = filterToolsByDomain(fifty, "general");
    expect(out).toHaveLength(MAX_TOOLS);
  });

  it("0 tools input → 0 tools output (no crash)", () => {
    expect(filterToolsByDomain([], "general")).toEqual([]);
    expect(filterToolsByDomain([], "communication")).toEqual([]);
  });

  it("unknown domain falls through to no-restriction (capped at 40)", () => {
    const out = filterToolsByDomain(allTools, "unknown_domain");
    expect(out).toHaveLength(allTools.length);
  });

  // Single read-heavy app (40 reads + 2 writes = 42 tools,
  // cap at 40) — interleave guarantees both a read AND a write survive the cap.
  //
  // FAILURE mode of the old "all-reads-first" sort: the sort puts all 40 reads
  // first, they fill the 40-cap entirely, and GITHUB_CREATE_ISSUE is evicted.
  // This test FAILS on that ordering and PASSES only with the interleave
  // (read0, write0, read1, write1, …) which places writes at slots 1 and 3.
  it("write action survives the 40-cap even when ≥40 read tools exist in the same app", () => {
    // 40 read tools (GET_00..GET_38 + LIST_PULLS) — in NATIVE (not alphabetical) order.
    // Composio v3 returns actions in native order; filterToolsByDomain cannot assume
    // alphabetical ordering.
    const reads: DiscoveredTool[] = [
      ...Array.from({ length: 39 }, (_, i) =>
        tool(`GITHUB_GET_${String(i).padStart(2, "0")}`, "github"),
      ),
      tool("GITHUB_LIST_PULLS", "github"),
    ];
    // 2 write tools — in native order, they happen to appear before the reads here.
    // Under the old "reads-first" sort, they land at positions 40 and 41 (evicted).
    const writes: DiscoveredTool[] = [
      tool("GITHUB_CREATE_ISSUE", "github"),
      tool("GITHUB_CREATE_PR", "github"),
    ];
    // Native input order: writes first, then reads (matching one realistic scenario).
    // Interleave → slot 0=GET_00, slot 1=CREATE_ISSUE, slot 2=GET_01, slot 3=CREATE_PR,
    //              then GET_02..GET_37 fill remaining slots 4-39.
    const githubTools = [...writes, ...reads];

    const out = filterToolsByDomain(githubTools, "developer");
    expect(out).toHaveLength(MAX_TOOLS);

    const names = out.map((t) => t.name);
    // Read tools survive (trivially true but confirms filter is live)
    expect(names).toContain("GITHUB_GET_00");
    // Write must survive — this FAILS on all-reads-first, PASSES on interleave
    expect(names).toContain("GITHUB_CREATE_ISSUE");
    expect(names).toContain("GITHUB_CREATE_PR");
  });

  // Round-robin must not let a dominant app starve a minority.
  // 45 github tools + 2 jira tools = 47 total, capped at 40.
  // WITHOUT round-robin: github fills 40 slots and jira (last) is fully evicted.
  // WITH round-robin: layer 0 picks 1 github + 1 jira (github=35 remain), …
  // — jira is guaranteed to appear in the output.
  // This test FAILS on a naive first-come-first-served ordering and PASSES only
  // with the multi-layer round-robin.
  it("round-robin distributes across apps — minority app (jira) survives when dominant (github) has ≥40 tools", () => {
    // 45 github tools: 40 reads + 5 writes (interleaved internally)
    const githubTools = [
      ...Array.from({ length: 5 }, (_, i) => tool(`GITHUB_CREATE_${i}`, "github")),
      ...Array.from({ length: 40 }, (_, i) =>
        tool(`GITHUB_GET_${String(i).padStart(2, "0")}`, "github"),
      ),
    ];
    // 2 jira tools — without round-robin these would be evicted by github's 45
    const jiraTools = [tool("JIRA_GET_ISSUE", "jira"), tool("JIRA_LIST_PROJECTS", "jira")];

    // Total = 47, cap = 40. Without round-robin jira gets 0 slots.
    const out = filterToolsByDomain([...githubTools, ...jiraTools], "developer");
    expect(out).toHaveLength(MAX_TOOLS);

    const apps = out.map((t) => t.app);
    // Both must appear — jira must NOT be starved
    expect(apps).toContain("github");
    expect(apps).toContain("jira");
    // Jira must get both of its tools (only 2, round-robin gives them slots before
    // github exhausts the cap)
    const jiraNames = out.filter((t) => t.app === "jira").map((t) => t.name);
    expect(jiraNames).toContain("JIRA_GET_ISSUE");
    expect(jiraNames).toContain("JIRA_LIST_PROJECTS");
  });

  it("MAX_TOOLS cap is exactly 40 (not raised)", () => {
    // 60 tools from a single app — cap must cut at MAX_TOOLS
    const many = Array.from({ length: 60 }, (_, i) => tool(`GITHUB_GET_${i}`, "github"));
    const out = filterToolsByDomain(many, "developer");
    expect(out).toHaveLength(MAX_TOOLS);
  });

  // Essential-reads survive the 40-cap.
  //
  // Simulates the real scenario: getToolsForUser returns 45 noise READ actions
  // (names that isWriteAction returns false for) plus one essential read
  // (GITHUB_GET_A_REPOSITORY) PREPENDED at the front. Then filterToolsByDomain
  // caps at 40. The essential must survive.
  //
  // FAILS with APPEND (essential is at position 45 → evicted).
  // PASSES with PREPEND (essential is at position 0 → slot 0 → survives).
  it("essential read survives 40-cap when prepended (fails with append)", () => {
    // 45 non-essential READ-classified actions (GITHUB_GET_XX / GITHUB_LIST_YY
    // — isWriteAction returns false for all of them).
    const noiseReads = [
      ...Array.from({ length: 30 }, (_, i) =>
        tool(`GITHUB_GET_NOISE_${String(i).padStart(2, "0")}`, "github"),
      ),
      ...Array.from({ length: 15 }, (_, i) =>
        tool(`GITHUB_LIST_NOISE_${String(i).padStart(2, "0")}`, "github"),
      ),
    ];

    const essential = tool("GITHUB_GET_A_REPOSITORY", "github");

    // PREPEND scenario (what the fixed code does):
    // essential leads → it's at index 0 → slot 0 in the reads bucket → survives.
    const prepended = [essential, ...noiseReads]; // 46 total, cap = MAX_TOOLS
    const outPrepend = filterToolsByDomain(prepended, "developer");
    expect(outPrepend).toHaveLength(MAX_TOOLS);
    expect(outPrepend.map((t) => t.name)).toContain("GITHUB_GET_A_REPOSITORY");

    // APPEND scenario (the broken pre-fix behaviour):
    // essential is last → it's at index 45 → evicted by the cap.
    const appended = [...noiseReads, essential]; // 46 total, cap = MAX_TOOLS
    const outAppend = filterToolsByDomain(appended, "developer");
    expect(outAppend).toHaveLength(MAX_TOOLS);
    // This assertion demonstrates WHY append was broken:
    expect(outAppend.map((t) => t.name)).not.toContain("GITHUB_GET_A_REPOSITORY");
  });

  it("is case-insensitive on the tool app slug", () => {
    const mixed: DiscoveredTool[] = [
      tool("GMAIL_SEND_EMAIL", "Gmail"),
      tool("SLACK_SEND_MESSAGE", "SLACK"),
      tool("GITHUB_CREATE_ISSUE", "GitHub"),
    ];
    const out = filterToolsByDomain(mixed, "communication");
    const names = out.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(["GMAIL_SEND_EMAIL", "SLACK_SEND_MESSAGE"]));
    expect(names).not.toContain("GITHUB_CREATE_ISSUE");
  });

  // Essential seeding in multi-app "general" domain.
  //
  // Scenario: 3 apps (github 60 tools, linear 21, slack 60), each with 3-4
  // essential tools flagged `essential:true` that sit DEEP in their per-app
  // bucket (position 55-59 for github/slack, 18-20 for linear). Without seeding,
  // the ~13-slots-per-app round-robin would evict them all.
  //
  // FAILS without the Stage 1 seed step (essentials are in the round-robin
  // bucket and evicted by the slot cap). PASSES with seeding.
  //
  // Also asserts that the reserve doesn't eat the full budget: non-essential
  // write tools still get slots in the remaining 20.
  it("essential reads survive in multi-app 'general' domain regardless of bucket depth", () => {
    // ── GitHub: 60 tools total, essentials at positions 56-59 (deep) ─────
    const githubNoise = Array.from({ length: 56 }, (_, i) =>
      tool(`GITHUB_GET_NOISE_${String(i).padStart(2, "0")}`, "github"),
    );
    const githubEssentials = [
      tool("GITHUB_GET_A_REPOSITORY", "github", true),
      tool("GITHUB_FIND_PULL_REQUESTS", "github", true),
      tool("GITHUB_GET_AN_ISSUE", "github", true),
      tool("GITHUB_FIND_REPOSITORIES", "github", true),
    ];
    // Essentials sit at the END of the github bucket (deep, would be evicted)
    const githubTools = [...githubNoise, ...githubEssentials];
    expect(githubTools).toHaveLength(60);

    // ── Linear: 21 tools total, essentials at positions 18-20 (deep) ─────
    const linearNoise = Array.from({ length: 18 }, (_, i) =>
      tool(`LINEAR_GET_NOISE_${String(i).padStart(2, "0")}`, "linear"),
    );
    const linearEssentials = [
      tool("LINEAR_LIST_LINEAR_ISSUES", "linear", true),
      tool("LINEAR_GET_LINEAR_ISSUE", "linear", true),
      tool("LINEAR_LIST_LINEAR_TEAMS", "linear", true),
    ];
    const linearTools = [...linearNoise, ...linearEssentials];
    expect(linearTools).toHaveLength(21);

    // ── Slack: 60 tools total, essentials at positions 56-59 (deep) ──────
    const slackNoise = Array.from({ length: 56 }, (_, i) =>
      tool(`SLACK_GET_NOISE_${String(i).padStart(2, "0")}`, "slack"),
    );
    const slackEssentials = [
      tool("SLACK_FETCH_CONVERSATION_HISTORY", "slack", true),
      tool("SLACK_LIST_ALL_CHANNELS", "slack", true),
      tool("SLACK_FIND_USER_BY_EMAIL_ADDRESS", "slack", true),
      tool("SLACK_LIST_ALL_SLACK_TEAM_USERS_WITH_PAGINATION", "slack", true),
    ];
    const slackTools = [...slackNoise, ...slackEssentials];
    expect(slackTools).toHaveLength(60);

    // ── Non-essential write tools (must still survive in remaining slots) ─
    // Placed at the front of github bucket so they are NOT evicted by seeding.
    const githubWrite = tool("GITHUB_CREATE_ISSUE", "github");
    const slackWrite = tool("SLACK_SEND_MESSAGE", "slack");

    const allTools = [githubWrite, ...githubTools, slackWrite, ...slackTools, ...linearTools];
    // Total = 1 + 60 + 1 + 60 + 21 = 143 tools, capped at 40.

    const out = filterToolsByDomain(allTools, "general");
    expect(out).toHaveLength(MAX_TOOLS); // still exactly 40

    const names = new Set(out.map((t) => t.name));

    // ── All 11 essentials (across 3 apps) must survive ──────────────────
    // github essentials (4)
    expect(names.has("GITHUB_GET_A_REPOSITORY")).toBe(true);
    expect(names.has("GITHUB_FIND_PULL_REQUESTS")).toBe(true);
    expect(names.has("GITHUB_GET_AN_ISSUE")).toBe(true);
    expect(names.has("GITHUB_FIND_REPOSITORIES")).toBe(true);
    // linear essentials (3)
    expect(names.has("LINEAR_LIST_LINEAR_ISSUES")).toBe(true);
    expect(names.has("LINEAR_GET_LINEAR_ISSUE")).toBe(true);
    expect(names.has("LINEAR_LIST_LINEAR_TEAMS")).toBe(true);
    // slack essentials (4)
    expect(names.has("SLACK_FETCH_CONVERSATION_HISTORY")).toBe(true);
    expect(names.has("SLACK_LIST_ALL_CHANNELS")).toBe(true);
    expect(names.has("SLACK_FIND_USER_BY_EMAIL_ADDRESS")).toBe(true);
    expect(names.has("SLACK_LIST_ALL_SLACK_TEAM_USERS_WITH_PAGINATION")).toBe(true);

    // ── The reserve (20 slots) did NOT consume the full budget ───────────
    // At least one non-essential write must have survived in the remaining 20 slots.
    const hasWrite = names.has("GITHUB_CREATE_ISSUE") || names.has("SLACK_SEND_MESSAGE");
    expect(hasWrite).toBe(true);

    // ── No duplicates ────────────────────────────────────────────────────
    expect(out).toHaveLength(new Set(out.map((t) => t.name)).size);
  });

  // Negative confirmation: without the seed step, deep-bucket tools are evicted.
  // This test runs filterToolsByDomain WITHOUT the essential flag on the tools
  // (simulating the pre-fix behaviour where essential===undefined for all tools).
  // With pure round-robin and ~13 slots/app, deep-bucket tools at positions 55-59
  // are evicted. The essentials must NOT appear.
  it("without essential flag, deep-bucket tools are evicted by round-robin (confirms seeding is load-bearing)", () => {
    // Same structure as the previous test but WITHOUT essential:true flags → simulates pre-fix.
    const githubNoise = Array.from({ length: 56 }, (_, i) =>
      tool(`GITHUB_GET_NOISE_${String(i).padStart(2, "0")}`, "github"),
    );
    // NOT flagged essential
    const githubDeep = [
      tool("GITHUB_GET_A_REPOSITORY", "github"),
      tool("GITHUB_FIND_PULL_REQUESTS", "github"),
      tool("GITHUB_GET_AN_ISSUE", "github"),
      tool("GITHUB_FIND_REPOSITORIES", "github"),
    ];
    const linearNoise = Array.from({ length: 18 }, (_, i) =>
      tool(`LINEAR_GET_NOISE_${String(i).padStart(2, "0")}`, "linear"),
    );
    const linearDeep = [
      tool("LINEAR_LIST_LINEAR_ISSUES", "linear"),
      tool("LINEAR_GET_LINEAR_ISSUE", "linear"),
      tool("LINEAR_LIST_LINEAR_TEAMS", "linear"),
    ];
    const slackNoise = Array.from({ length: 56 }, (_, i) =>
      tool(`SLACK_GET_NOISE_${String(i).padStart(2, "0")}`, "slack"),
    );
    const slackDeep = [
      tool("SLACK_FETCH_CONVERSATION_HISTORY", "slack"),
      tool("SLACK_LIST_ALL_CHANNELS", "slack"),
      tool("SLACK_FIND_USER_BY_EMAIL_ADDRESS", "slack"),
      tool("SLACK_LIST_ALL_SLACK_TEAM_USERS_WITH_PAGINATION", "slack"),
    ];

    const allTools = [
      ...githubNoise,
      ...githubDeep,
      ...slackNoise,
      ...slackDeep,
      ...linearNoise,
      ...linearDeep,
    ];

    const out = filterToolsByDomain(allTools, "general");
    expect(out).toHaveLength(MAX_TOOLS);

    const names = new Set(out.map((t) => t.name));

    // With 3 apps of 60/60/21 and round-robin giving ~13 slots/app,
    // tools at positions 56-59 in github/slack are EVICTED.
    // At least some of the deep-bucket tools must be absent (confirming the fix is load-bearing).
    const deepToolNames = [
      "GITHUB_GET_A_REPOSITORY",
      "GITHUB_FIND_PULL_REQUESTS",
      "GITHUB_GET_AN_ISSUE",
      "GITHUB_FIND_REPOSITORIES",
      "SLACK_FETCH_CONVERSATION_HISTORY",
      "SLACK_LIST_ALL_CHANNELS",
      "SLACK_FIND_USER_BY_EMAIL_ADDRESS",
      "SLACK_LIST_ALL_SLACK_TEAM_USERS_WITH_PAGINATION",
    ];
    const survivingDeep = deepToolNames.filter((n) => names.has(n));
    // Without seeding, NONE of the deep (pos 56-59) tools survive (total eviction).
    expect(survivingDeep.length).toBe(0);
  });

  // Round-robin seed fairness across ≥6 apps.
  //
  // 8 apps, each with 4 essential tools positioned DEEP in their bucket
  // (preceded by 30 non-essential reads). Total essentials = 32 > ESSENTIAL_RESERVE (20).
  //
  // FAILS on sequential seed: the first 5 apps consume all 20 reserve slots
  // (5×4=20), leaving apps 6/7/8 with 0 essentials each.
  //
  // PASSES on round-robin seed: layer 0 places 1 essential per app (8 slots),
  // layer 1 places another 1 per app (8 more = 16), layer 2 places 4 more
  // (reserve hit at 20) — every app has received ≥1 essential.
  it("round-robin seed is fair — with 8 apps × 4 essentials (32 > reserve 20), every app gets ≥1 essential", () => {
    const APP_NAMES = [
      "gmail",
      "slack",
      "github",
      "notion",
      "googledrive",
      "hubspot",
      "linear",
      "figma",
    ];
    // Each app: 30 non-essential noise reads, then 4 essentials deep in bucket.
    const allTools: DiscoveredTool[] = [];
    for (const app of APP_NAMES) {
      for (let i = 0; i < 30; i++) {
        allTools.push(tool(`${app.toUpperCase()}_GET_NOISE_${String(i).padStart(2, "0")}`, app));
      }
      for (let j = 0; j < 4; j++) {
        allTools.push(tool(`${app.toUpperCase()}_ESSENTIAL_${j}`, app, true));
      }
    }
    // 8 × 34 = 272 total tools, capped at MAX_TOOLS (40).

    const out = filterToolsByDomain(allTools, "general");

    // Cap respected.
    expect(out).toHaveLength(MAX_TOOLS);

    // No duplicates.
    expect(out).toHaveLength(new Set(out.map((t) => t.name)).size);

    // Count seeded essentials (tools with essential:true in the output).
    // The reserve is exactly 20 — all 20 slots must be filled (32 candidates available).
    const seededEssentials = out.filter((t) => t.essential === true);
    expect(seededEssentials).toHaveLength(20);

    // FAIRNESS: every app must have ≥1 essential in the output.
    // Sequential seed would give the last ~3 apps (googledrive, hubspot, linear, figma) 0 essentials.
    for (const app of APP_NAMES) {
      const appEssentials = out.filter((t) => t.app === app && t.essential === true);
      expect(appEssentials.length).toBeGreaterThanOrEqual(1);
    }
  });
});
