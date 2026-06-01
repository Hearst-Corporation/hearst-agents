import { afterEach, describe, expect, it, vi } from "vitest";
import {
  _resetResolveCacheForTest,
  isFullGrantContext,
  resolveCapabilities,
  resolveCapabilityContextId,
  shouldSkipCortexResolve,
} from "@/lib/capabilities/cortex-resolver";
import { logger } from "@/lib/observability/logger";

describe("cortex-resolver", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    _resetResolveCacheForTest();
  });

  it("mappe cortex_search depuis runtime hive:tool:cortex_search", async () => {
    vi.stubEnv("CORTEX_URL", "https://cortex.hearst.app");
    vi.stubEnv("CORTEX_PUBLIC_API_KEY", "pk-test");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        capabilities: [{ slug: "cortex_search", runtime: "hive:tool:cortex_search", risk: "high" }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveCapabilities({
      tenantId: "d10c9c22-2432-4daa-b4f2-ab849a87dfae",
      contextId: "adrien",
      userId: "user-1",
    });

    expect(result.status).toBe("ok");
    expect(result.tools).toEqual(["cortex_search"]);
  });

  it("retourne empty quand Cortex retourne []", async () => {
    vi.stubEnv("CORTEX_URL", "https://cortex.hearst.app");
    vi.stubEnv("CORTEX_PUBLIC_API_KEY", "pk-test");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ capabilities: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveCapabilities({
      tenantId: "d10c9c22-2432-4daa-b4f2-ab849a87dfae",
      contextId: "adrien",
      userId: "user-1",
    });

    expect(result.status).toBe("empty");
    expect(result.tools).toEqual([]);
  });

  it("mappe cortex_search depuis la shape canonique Cortex items[]", async () => {
    vi.stubEnv("CORTEX_URL", "https://cortex.hearst.app");
    vi.stubEnv("CORTEX_PUBLIC_API_KEY", "pk-test");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [{ slug: "cortex_search", runtime: "hive:tool:cortex_search" }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveCapabilities({
      tenantId: "adrien",
      contextId: "adrien",
      userId: "adrien",
    });

    expect(result.status).toBe("ok");
    expect(result.tools).toEqual(["cortex_search"]);
  });

  it("mappe gmail vers ses deux tools Helm (fetch + send)", async () => {
    vi.stubEnv("CORTEX_URL", "https://cortex.hearst.app");
    vi.stubEnv("CORTEX_PUBLIC_API_KEY", "pk-test");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [{ slug: "gmail", runtime: "hive:tool:gmail" }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveCapabilities({
      tenantId: "adrien",
      contextId: "adrien",
      userId: "adrien",
    });

    expect(result.status).toBe("ok");
    expect(result.tools).toEqual(["gmail_fetch_emails", "gmail_send_email"]);
  });

  it("mappe un lot de capabilities réelles et ignore les non mappées", async () => {
    vi.stubEnv("CORTEX_URL", "https://cortex.hearst.app");
    vi.stubEnv("CORTEX_PUBLIC_API_KEY", "pk-test");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          { slug: "gmail", runtime: "hive:tool:gmail" },
          { slug: "web", runtime: "hive:tool:web" },
          { slug: "sandbox", runtime: "hive:tool:sandbox" },
          { slug: "shell", runtime: "hive:tool:shell" }, // pas d'équivalent Helm → ignoré
          { slug: "supabase_sql", runtime: "hive:tool:supabase_sql" }, // idem
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveCapabilities({
      tenantId: "adrien",
      contextId: "adrien",
      userId: "adrien",
    });

    expect(result.status).toBe("ok");
    expect(result.tools).toEqual([
      "gmail_fetch_emails",
      "gmail_send_email",
      "web_search",
      "run_code",
    ]);
    // les capabilities sans tool Helm ne fuient pas
    expect(result.tools).not.toContain("shell");
    expect(result.tools).not.toContain("supabase_sql");
  });

  it("retourne error contrôlé pour HTTP 500", async () => {
    vi.stubEnv("CORTEX_URL", "https://cortex.hearst.app");
    vi.stubEnv("CORTEX_PUBLIC_API_KEY", "pk-test");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveCapabilities({
      tenantId: "d10c9c22-2432-4daa-b4f2-ab849a87dfae",
      contextId: "adrien",
      userId: "user-1",
    });

    expect(result.status).toBe("error");
    expect(result.httpStatus).toBe(500);
    expect(result.tools).toEqual([]);
  });

  it("retourne error contrôlé pour HTTP 503", async () => {
    vi.stubEnv("CORTEX_URL", "https://cortex.hearst.app");
    vi.stubEnv("CORTEX_PUBLIC_API_KEY", "pk-test");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveCapabilities({
      tenantId: "d10c9c22-2432-4daa-b4f2-ab849a87dfae",
      contextId: "adrien",
      userId: "user-1",
    });

    expect(result.status).toBe("error");
    expect(result.httpStatus).toBe(503);
    expect(result.tools).toEqual([]);
  });

  it("ignore capability inconnue (runtime/slug non mappé)", async () => {
    vi.stubEnv("CORTEX_URL", "https://cortex.hearst.app");
    vi.stubEnv("CORTEX_PUBLIC_API_KEY", "pk-test");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        capabilities: [{ slug: "unknown_capability", runtime: "hive:tool:unknown_capability" }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveCapabilities({
      tenantId: "d10c9c22-2432-4daa-b4f2-ab849a87dfae",
      contextId: "adrien",
      userId: "user-1",
    });

    expect(result.status).toBe("empty");
    expect(result.tools).toEqual([]);
  });

  it("resolveCapabilityContextId utilise hive:<context> quand présent", () => {
    const contextId = resolveCapabilityContextId({
      composioEntityId: "hive:adrien",
      tenantId: "d10c9c22-2432-4daa-b4f2-ab849a87dfae",
    });
    expect(contextId).toBe("adrien");
  });

  it("resolveCapabilityContextId fallback tenantId hors impersonation", () => {
    const contextId = resolveCapabilityContextId({
      composioEntityId: undefined,
      tenantId: "d10c9c22-2432-4daa-b4f2-ab849a87dfae",
    });
    expect(contextId).toBe("d10c9c22-2432-4daa-b4f2-ab849a87dfae");
  });

  it("ne log pas d'URL/secrets sur erreur réseau", async () => {
    vi.stubEnv("CORTEX_URL", "https://cortex.hearst.app");
    vi.stubEnv("CORTEX_PUBLIC_API_KEY", "pk-test-secret-value");
    const warnSpy = vi.spyOn(logger, "warn");
    const fetchMock = vi
      .fn()
      .mockRejectedValue(
        new Error("https://cortex.hearst.app/api/capabilities/resolve?token=super-secret-token"),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveCapabilities({
      tenantId: "d10c9c22-2432-4daa-b4f2-ab849a87dfae",
      contextId: "adrien",
      userId: "user-1",
    });

    expect(result.status).toBe("error");
    const logs = JSON.stringify(warnSpy.mock.calls);
    expect(logs).not.toContain("super-secret-token");
    expect(logs).not.toContain("https://cortex.hearst.app/api/capabilities/resolve");
    expect(logs).not.toContain("pk-test-secret-value");
  });

  it("cache : 2e appel même contexte ne refait pas le fetch", async () => {
    vi.stubEnv("CORTEX_URL", "https://cortex.hearst.app");
    vi.stubEnv("CORTEX_PUBLIC_API_KEY", "pk-test");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ items: [{ slug: "gmail", runtime: "hive:tool:gmail" }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const args = { tenantId: "adrien", contextId: "adrien", userId: "adrien" };
    const first = await resolveCapabilities(args);
    const second = await resolveCapabilities(args);

    expect(first.tools).toEqual(["gmail_fetch_emails", "gmail_send_email"]);
    expect(second.tools).toEqual(first.tools);
    // un seul appel réseau : le 2e est servi par le cache
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shouldSkipCortexResolve : court-circuit conversationnel (direct_answer)", () => {
    const d = shouldSkipCortexResolve("direct_answer", "adrien");
    expect(d.skip).toBe(true);
    expect(d.reason).toBe("conversational");
  });

  it("shouldSkipCortexResolve : résout (pas de court-circuit) en tool_call hors full-grant", () => {
    const d = shouldSkipCortexResolve("tool_call", "some-gated-context");
    expect(d.skip).toBe(false);
    expect(d.reason).toBe("resolve");
  });

  it("shouldSkipCortexResolve : court-circuit full-grant via env (prioritaire sur le mode)", () => {
    vi.stubEnv("HELM_CORTEX_FULL_GRANT_CONTEXTS", "adrien, test2");
    const d = shouldSkipCortexResolve("tool_call", "adrien");
    expect(d.skip).toBe(true);
    expect(d.reason).toBe("full_grant_context");
  });

  it("isFullGrantContext : insensible à la casse et aux espaces, vide si env absente", () => {
    expect(isFullGrantContext("adrien")).toBe(false); // env non set
    vi.stubEnv("HELM_CORTEX_FULL_GRANT_CONTEXTS", " Adrien , test2 ");
    expect(isFullGrantContext("adrien")).toBe(true);
    expect(isFullGrantContext("ADRIEN")).toBe(true);
    expect(isFullGrantContext("autre")).toBe(false);
  });
});
