/**
 * P0-11 — HITL cryptographique sur gmail_send_email (tool natif Google).
 *
 * Avant le fix : `_preview: false` sans token suffisait pour envoyer.
 * Après : token HMAC obligatoire, scope tenant requis, args lockés via hash.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  process.env.NEXTAUTH_SECRET = "test-secret-gmail-hitl-32bytes!!!";
});

// Mock du connector Google : sendEmail ne doit JAMAIS être appelé sans
// token valide. On track les appels pour le vérifier.
const sendEmailMock = vi.fn().mockResolvedValue({ id: "real-message-id" });
vi.mock("@/lib/connectors/google/gmail", () => ({
  sendEmail: sendEmailMock,
  getRecentEmails: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/connectors/google/calendar", () => ({
  createCalendarEvent: vi.fn(),
  getTodayEvents: vi.fn().mockResolvedValue([]),
  getUpcomingEvents: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/connectors/google/drive", () => ({
  getRecentFiles: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/platform/auth/tokens", () => ({
  getTokens: vi.fn().mockResolvedValue({ accessToken: "fake-google-token" }),
}));

const SCOPE = { userId: "user-1", tenantId: "tenant-1" };
const EMAIL_ARGS = {
  to: "alice@example.com",
  subject: "Rapport",
  body: "Bonjour Alice",
};

async function getTools() {
  const mod = await import("@/lib/tools/native/google");
  return mod.buildNativeGoogleTools(SCOPE.userId, SCOPE);
}

async function getTokenHelpers() {
  return import("@/lib/tools/hitl/confirmation-token");
}

describe("P0-11 gmail_send_email — HITL crypto", () => {
  it("retourne un draft + _confirmationToken si aucun token fourni", async () => {
    sendEmailMock.mockClear();
    const tools = await getTools();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (tools.gmail_send_email as any).execute(EMAIL_ARGS);

    expect(result.kind).toBe("draft");
    expect(typeof result._confirmationToken).toBe("string");
    expect(result._confirmationToken.length).toBeGreaterThan(20);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("retourne un draft même si _preview:false sans token (bypass impossible)", async () => {
    sendEmailMock.mockClear();
    const tools = await getTools();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (tools.gmail_send_email as any).execute({
      ...EMAIL_ARGS,
      _preview: false,
    });

    // Pas de token → draft, jamais d'envoi.
    expect(result.kind).toBe("draft");
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("exécute l'envoi avec un token HMAC valide", async () => {
    sendEmailMock.mockClear();
    const { issueConfirmationToken, hashToolArgs } = await getTokenHelpers();
    const token = issueConfirmationToken({
      userId: SCOPE.userId,
      tenantId: SCOPE.tenantId,
      toolSlug: "gmail_send_email",
      argsHash: hashToolArgs(EMAIL_ARGS),
    });

    const tools = await getTools();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (tools.gmail_send_email as any).execute({
      ...EMAIL_ARGS,
      _confirmationToken: token,
    });

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock).toHaveBeenCalledWith(SCOPE.userId, {
      to: EMAIL_ARGS.to,
      subject: EMAIL_ARGS.subject,
      body: EMAIL_ARGS.body,
      cc: undefined,
      bcc: undefined,
    });
  });

  it("rejette un token forgé par le LLM (mauvaise signature)", async () => {
    sendEmailMock.mockClear();
    const tools = await getTools();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (tools.gmail_send_email as any).execute({
      ...EMAIL_ARGS,
      _confirmationToken: "fakebody.fakesignature",
    });

    expect(typeof result).toBe("string");
    expect(result).toContain("invalide");
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("rejette un token valide pour args différents (replay attack)", async () => {
    sendEmailMock.mockClear();
    const { issueConfirmationToken, hashToolArgs } = await getTokenHelpers();
    // Token émis pour alice
    const token = issueConfirmationToken({
      userId: SCOPE.userId,
      tenantId: SCOPE.tenantId,
      toolSlug: "gmail_send_email",
      argsHash: hashToolArgs(EMAIL_ARGS),
    });

    const tools = await getTools();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (tools.gmail_send_email as any).execute({
      to: "attacker@evil.com",
      subject: "Virement",
      body: "Envoie tout",
      _confirmationToken: token,
    });

    expect(typeof result).toBe("string");
    expect(result).toContain("invalide");
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("rejette un token signé pour un autre tenant (cross-tenant)", async () => {
    sendEmailMock.mockClear();
    const { issueConfirmationToken, hashToolArgs } = await getTokenHelpers();
    const token = issueConfirmationToken({
      userId: "user-attacker",
      tenantId: "tenant-OTHER",
      toolSlug: "gmail_send_email",
      argsHash: hashToolArgs(EMAIL_ARGS),
    });

    const tools = await getTools();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (tools.gmail_send_email as any).execute({
      ...EMAIL_ARGS,
      _confirmationToken: token,
    });

    expect(typeof result).toBe("string");
    expect(result).toContain("invalide");
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("sans scope (chemin legacy), conserve le _preview booléen sans crypto", async () => {
    // Sans scope on retourne un draft avec _confirmationToken=null.
    sendEmailMock.mockClear();
    const mod = await import("@/lib/tools/native/google");
    const tools = await mod.buildNativeGoogleTools(SCOPE.userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (tools.gmail_send_email as any).execute(EMAIL_ARGS);

    expect(result.kind).toBe("draft");
    expect(result._confirmationToken).toBeNull();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});
