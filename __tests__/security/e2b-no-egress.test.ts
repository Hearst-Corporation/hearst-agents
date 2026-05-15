/**
 * B2.3 — E2B sandbox no-egress
 *
 * F-023 : Sandbox E2B doit être créé avec networkAccess:false + env:{}
 * Valide via mock que les options de sécurité sont bien passées à Sandbox.create().
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock E2B ─────────────────────────────────────────────────────────────────

const mockSandboxCreate = vi.hoisted(() => vi.fn());
const mockRunCode = vi.hoisted(() => vi.fn());
const mockKill = vi.hoisted(() => vi.fn());

vi.mock("@e2b/code-interpreter", () => ({
  Sandbox: {
    create: mockSandboxCreate,
  },
}));

// ── Setup ─────────────────────────────────────────────────────────────────────

const DEFAULT_EXECUTION = {
  logs: { stdout: ["hello"], stderr: [] },
  results: [],
  error: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRunCode.mockResolvedValue(DEFAULT_EXECUTION);
  mockKill.mockResolvedValue(undefined);
  mockSandboxCreate.mockResolvedValue({
    runCode: mockRunCode,
    kill: mockKill,
  });

  // Set E2B API key pour éviter le early return
  vi.stubEnv("E2B_API_KEY", "test-e2b-key");
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("executeCode — E2B sandbox options sécurité", () => {
  it("crée le sandbox avec allowInternetAccess: false", async () => {
    const { executeCode } = await import("@/lib/capabilities/providers/e2b");

    await executeCode({ code: "print('hello')", language: "python" });

    expect(mockSandboxCreate).toHaveBeenCalledOnce();
    const callArgs = mockSandboxCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(callArgs.allowInternetAccess).toBe(false);
  });

  it("crée le sandbox avec envs: {} (pas de variables héritées)", async () => {
    const { executeCode } = await import("@/lib/capabilities/providers/e2b");

    await executeCode({ code: "print('hello')", language: "python" });

    const callArgs = mockSandboxCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(callArgs.envs).toEqual({});
  });

  it("crée le sandbox avec l'API key E2B", async () => {
    const { executeCode } = await import("@/lib/capabilities/providers/e2b");

    await executeCode({ code: "console.log('hi')", language: "javascript" });

    const callArgs = mockSandboxCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(callArgs.apiKey).toBe("test-e2b-key");
  });

  it("retourne une erreur si E2B_API_KEY est absent", async () => {
    vi.stubEnv("E2B_API_KEY", "");
    const { executeCode } = await import("@/lib/capabilities/providers/e2b");

    const result = await executeCode({ code: "print(1)" });

    expect(result.error).toBe("E2B non configuré");
    expect(mockSandboxCreate).not.toHaveBeenCalled();
  });

  it("kill le sandbox même en cas d'erreur d'exécution", async () => {
    mockRunCode.mockRejectedValue(new Error("timeout sandbox"));
    const { executeCode } = await import("@/lib/capabilities/providers/e2b");

    const result = await executeCode({ code: "import time; time.sleep(999)" });

    expect(result.error).toBe("timeout sandbox");
    expect(mockKill).toHaveBeenCalledOnce();
  });

  it("passe le timeoutMs au runCode", async () => {
    const { executeCode } = await import("@/lib/capabilities/providers/e2b");

    await executeCode({ code: "print(1)", language: "python", timeoutMs: 5000 });

    expect(mockRunCode).toHaveBeenCalledWith("print(1)", {
      language: "python",
      timeoutMs: 5000,
    });
  });
});
