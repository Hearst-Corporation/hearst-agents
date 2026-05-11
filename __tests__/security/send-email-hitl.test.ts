/**
 * F-010 — send_email HITL cryptographique (extras-services)
 *
 * Vérifie que sendEmailTool :
 *   - retourne un draft + confirmationToken (jamais d'envoi direct) sans token
 *   - exécute l'envoi si le token HMAC est valide
 *   - rejette un token HMAC invalide / expiré / pour mauvais args
 *   - ne peut pas être contourné par _preview:false sans token
 */

import { describe, it, expect, beforeAll, vi } from "vitest";

beforeAll(() => {
  process.env.NEXTAUTH_SECRET = "test-secret-send-email-32bytes!!";
  process.env.RESEND_API_KEY = "re_test_key"; // active isResendEnabled()
  process.env.RESEND_FROM_EMAIL = "test@hearst.app";
});

// Mock Resend : utiliser une vraie class pour satisfaire `new Resend(...)`.
const mockSend = vi.fn().mockResolvedValue({ data: { id: "mock-email-id" }, error: null });
vi.mock("resend", () => {
  class Resend {
    emails = { send: mockSend };
     
    constructor(_key: string) {}
  }
  return { Resend };
});

// Mock Inngest (requis par l'import du module extras-services).
vi.mock("@/lib/jobs/inngest/client", () => ({
  inngest: { send: vi.fn() },
  isInngestEnabled: () => false,
}));

const getTools = async (scope?: { userId: string; tenantId: string }) => {
  // Reset module cache pour que chaque test reçoive un Resend client frais.
  const mod = await import("@/lib/tools/native/extras-services");
  return mod.buildExtrasServicesTools(scope);
};

const getTokenHelpers = async () => {
  return import("@/lib/tools/hitl/confirmation-token");
};

const SCOPE = { userId: "user-1", tenantId: "tenant-1" };
const EMAIL_ARGS = {
  to: "alice@example.com",
  subject: "Rapport",
  text: "Bonjour Alice",
};

describe("F-010 send_email — HITL HMAC token", () => {
  it("retourne un draft + _confirmationToken si aucun token fourni", async () => {
    const tools = await getTools(SCOPE);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (tools.send_email as any).execute(EMAIL_ARGS);

    expect(result.kind).toBe("draft");
    expect(typeof result._confirmationToken).toBe("string");
    expect(result._confirmationToken!.length).toBeGreaterThan(10);
  });

  it("retourne un draft même si _preview:false sans token (bypass LLM impossible)", async () => {
    const tools = await getTools(SCOPE);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (tools.send_email as any).execute({
      ...EMAIL_ARGS,
      _preview: false,
    });

    // Sans _confirmationToken, doit toujours retourner un draft.
    expect(result.kind).toBe("draft");
  });

  it("exécute l'envoi avec un token HMAC valide", async () => {
    const { issueConfirmationToken, hashToolArgs } = await getTokenHelpers();
    const token = issueConfirmationToken({
      userId: SCOPE.userId,
      tenantId: SCOPE.tenantId,
      toolSlug: "send_email",
      argsHash: hashToolArgs(EMAIL_ARGS),
    });

    const tools = await getTools(SCOPE);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (tools.send_email as any).execute({
      ...EMAIL_ARGS,
      _confirmationToken: token,
    });

    expect(typeof result).toBe("string");
    expect(result).toContain("mock-email-id");
  });

  it("rejette un token HMAC invalide (forgé par LLM)", async () => {
    const tools = await getTools(SCOPE);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (tools.send_email as any).execute({
      ...EMAIL_ARGS,
      _confirmationToken: "faketoken.fakesignature",
    });

    expect(typeof result).toBe("string");
    expect(result).toContain("invalide");
  });

  it("rejette un token valide pour args différents (replay attack)", async () => {
    const { issueConfirmationToken, hashToolArgs } = await getTokenHelpers();
    // Token émis pour alice@example.com
    const token = issueConfirmationToken({
      userId: SCOPE.userId,
      tenantId: SCOPE.tenantId,
      toolSlug: "send_email",
      argsHash: hashToolArgs({ to: "alice@example.com", subject: "Rapport", text: "Bonjour Alice" }),
    });

    const tools = await getTools(SCOPE);
    // Tentative d'utilisation du token pour un email différent
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (tools.send_email as any).execute({
      to: "attacker@evil.com",
      subject: "Virement",
      text: "Envoie tout",
      _confirmationToken: token,
    });

    expect(typeof result).toBe("string");
    expect(result).toContain("invalide");
  });

  it("rejette si scope absent (contexte hors-pipeline)", async () => {
    const { issueConfirmationToken, hashToolArgs } = await getTokenHelpers();
    const token = issueConfirmationToken({
      userId: SCOPE.userId,
      tenantId: SCOPE.tenantId,
      toolSlug: "send_email",
      argsHash: hashToolArgs(EMAIL_ARGS),
    });

    // buildExtrasServicesTools sans scope
    const tools = await getTools(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (tools.send_email as any).execute({
      ...EMAIL_ARGS,
      _confirmationToken: token,
    });

    expect(typeof result).toBe("string");
    expect(result).toContain("contexte utilisateur manquant");
  });

  it("le draft sans scope ne retourne pas de confirmationToken", async () => {
    const tools = await getTools(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (tools.send_email as any).execute(EMAIL_ARGS);

    expect(result.kind).toBe("draft");
    expect(result._confirmationToken).toBeNull();
  });
});
