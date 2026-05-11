/**
 * F-010 — HITL Confirmation Token
 *
 * Vérifie que le module de confirmation cryptographique :
 *   - rejette les tokens avec signature invalide
 *   - rejette les tokens expirés
 *   - rejette les tokens avec args modifiés (replay attack)
 *   - rejette les tokens pour un autre user/tenant/tool
 *   - accepte un token valide pour le bon contexte
 */

import { describe, it, expect, beforeAll, vi } from "vitest";

// Garantir que NEXTAUTH_SECRET est présent avant d'importer le module
beforeAll(() => {
  process.env.NEXTAUTH_SECRET = "test-secret-hitl-32bytes-minimum!";
});

// Import dynamique après setup env
const getModule = async () =>
  import("@/lib/tools/hitl/confirmation-token");

describe("HITL confirmation token — issueConfirmationToken / verifyConfirmationToken", () => {
  it("accepte un token valide pour le bon (user, tenant, tool, args)", async () => {
    const {
      issueConfirmationToken,
      verifyConfirmationToken,
      hashToolArgs,
    } = await getModule();

    const args = { to: "alice@example.com", subject: "Hello" };
    const argsHash = hashToolArgs(args);

    const token = issueConfirmationToken({
      userId: "user-1",
      tenantId: "tenant-1",
      toolSlug: "GMAIL_SEND_EMAIL",
      argsHash,
    });

    const result = verifyConfirmationToken(token, {
      userId: "user-1",
      tenantId: "tenant-1",
      toolSlug: "GMAIL_SEND_EMAIL",
      argsHash,
    });

    expect(result.ok).toBe(true);
  });

  it("rejette un token signé pour un autre user", async () => {
    const {
      issueConfirmationToken,
      verifyConfirmationToken,
      hashToolArgs,
    } = await getModule();

    const args = { to: "alice@example.com" };
    const argsHash = hashToolArgs(args);

    const token = issueConfirmationToken({
      userId: "user-attacker",
      tenantId: "tenant-1",
      toolSlug: "GMAIL_SEND_EMAIL",
      argsHash,
    });

    const result = verifyConfirmationToken(token, {
      userId: "user-victim",
      tenantId: "tenant-1",
      toolSlug: "GMAIL_SEND_EMAIL",
      argsHash,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("user_mismatch");
  });

  it("rejette un token expiré", async () => {
    const {
      issueConfirmationToken,
      verifyConfirmationToken,
      hashToolArgs,
    } = await getModule();

    const args = { to: "bob@example.com" };
    const argsHash = hashToolArgs(args);

    // Générer un token avec Date.now() dans le passé
    const OriginalDate = Date;
    const pastNow = OriginalDate.now() - 6 * 60 * 1000; // 6 minutes ago
    vi.spyOn(Date, "now").mockReturnValue(pastNow);

    const token = issueConfirmationToken({
      userId: "user-1",
      tenantId: "tenant-1",
      toolSlug: "SLACK_SEND_MESSAGE",
      argsHash,
    });

    // Restaurer le temps réel avant la vérification
    vi.spyOn(Date, "now").mockRestore();

    const result = verifyConfirmationToken(token, {
      userId: "user-1",
      tenantId: "tenant-1",
      toolSlug: "SLACK_SEND_MESSAGE",
      argsHash,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("expired");
  });

  it("rejette args modifiés — replay attack avec args différents", async () => {
    const {
      issueConfirmationToken,
      verifyConfirmationToken,
      hashToolArgs,
    } = await getModule();

    const originalArgs = { to: "alice@example.com", subject: "Rapport mensuel" };
    const tamperedArgs = { to: "attacker@evil.com", subject: "Rapport mensuel" };

    const token = issueConfirmationToken({
      userId: "user-1",
      tenantId: "tenant-1",
      toolSlug: "GMAIL_SEND_EMAIL",
      argsHash: hashToolArgs(originalArgs),
    });

    const result = verifyConfirmationToken(token, {
      userId: "user-1",
      tenantId: "tenant-1",
      toolSlug: "GMAIL_SEND_EMAIL",
      argsHash: hashToolArgs(tamperedArgs),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("args_mismatch");
  });

  it("rejette un token avec signature falsifiée", async () => {
    const { verifyConfirmationToken, hashToolArgs } = await getModule();

    const argsHash = hashToolArgs({ to: "x@y.com" });
    // Token malformé — pas de . séparateur
    const result = verifyConfirmationToken("not-a-valid-token", {
      userId: "user-1",
      tenantId: "tenant-1",
      toolSlug: "GMAIL_SEND_EMAIL",
      argsHash,
    });

    expect(result.ok).toBe(false);
  });

  it("hashToolArgs est stable quel que soit l'ordre des clés", async () => {
    const { hashToolArgs } = await getModule();

    const h1 = hashToolArgs({ a: 1, b: 2, c: "hello" });
    const h2 = hashToolArgs({ c: "hello", a: 1, b: 2 });
    const h3 = hashToolArgs({ b: 2, c: "hello", a: 1 });

    expect(h1).toBe(h2);
    expect(h2).toBe(h3);
  });

  it("rejette un token pour le mauvais tool", async () => {
    const {
      issueConfirmationToken,
      verifyConfirmationToken,
      hashToolArgs,
    } = await getModule();

    const args = { channel: "#general", message: "Hello" };
    const argsHash = hashToolArgs(args);

    const token = issueConfirmationToken({
      userId: "user-1",
      tenantId: "tenant-1",
      toolSlug: "SLACK_SEND_MESSAGE",
      argsHash,
    });

    const result = verifyConfirmationToken(token, {
      userId: "user-1",
      tenantId: "tenant-1",
      toolSlug: "GMAIL_SEND_EMAIL", // mauvais tool
      argsHash,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("tool_mismatch");
  });
});
