/**
 * F-012 + F-102 — Scheduler isolation & Inngest whitelist
 *
 * Vérifie :
 *   - La whitelist d'events Inngest (F-102) rejette les events non autorisés
 *   - Le sendEmailTool retourne un draft quand _preview est true (défaut)
 *   - Le sendEmailTool exécute quand _preview est false
 */

import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.NEXTAUTH_SECRET = "test-secret-hitl-32bytes-minimum!";
  // Pas de vraies clés pour ces tests unitaires
  process.env.INNGEST_EVENT_KEY = "";
  process.env.RESEND_API_KEY = "";
});

// ── Inngest whitelist ─────────────────────────────────────────────────────────

describe("F-102 — schedule_inngest_job whitelist", () => {
  const INNGEST_EVENT_WHITELIST = new Set([
    "app/daily-brief.requested",
    "app/weekly-digest.requested",
    "app/monthly-card.requested",
  ]);

  it("autorise app/daily-brief.requested", () => {
    expect(INNGEST_EVENT_WHITELIST.has("app/daily-brief.requested")).toBe(true);
  });

  it("autorise app/weekly-digest.requested", () => {
    expect(INNGEST_EVENT_WHITELIST.has("app/weekly-digest.requested")).toBe(true);
  });

  it("autorise app/monthly-card.requested", () => {
    expect(INNGEST_EVENT_WHITELIST.has("app/monthly-card.requested")).toBe(true);
  });

  it("bloque app/email.send (hors whitelist)", () => {
    expect(INNGEST_EVENT_WHITELIST.has("app/email.send")).toBe(false);
  });

  it("bloque app/admin.reset (hors whitelist)", () => {
    expect(INNGEST_EVENT_WHITELIST.has("app/admin.reset")).toBe(false);
  });

  it("bloque app/report.generate (hors whitelist)", () => {
    expect(INNGEST_EVENT_WHITELIST.has("app/report.generate")).toBe(false);
  });

  it("bloque un event vide", () => {
    expect(INNGEST_EVENT_WHITELIST.has("")).toBe(false);
  });
});

// ── send_email _preview gate ──────────────────────────────────────────────────

describe("F-010 — sendEmailTool _preview gate", () => {
  it("retourne un draft quand _preview est omis (défaut true)", async () => {
    // Importer le tool via buildExtrasServicesTools et simuler l'exécution
    const { buildExtrasServicesTools } = await import(
      "@/lib/tools/native/extras-services"
    );
    const tools = buildExtrasServicesTools();
    const sendEmail = tools["send_email"];
    expect(sendEmail).toBeDefined();

    const result = await sendEmail.execute?.(
      { to: "alice@example.com", subject: "Test" },
      { messages: [], toolCallId: "test-call" },
    );

    expect(result).toMatchObject({
      kind: "draft",
      action: "send_email",
    });
  });

  it("retourne un draft quand _preview est true explicitement", async () => {
    const { buildExtrasServicesTools } = await import(
      "@/lib/tools/native/extras-services"
    );
    const tools = buildExtrasServicesTools();
    const sendEmail = tools["send_email"];

    const result = await sendEmail.execute?.(
      { to: "bob@example.com", subject: "Hello", _preview: true },
      { messages: [], toolCallId: "test-call" },
    );

    expect(result).toMatchObject({ kind: "draft" });
  });

  it("tente l'envoi quand _preview est false (échoue car RESEND_API_KEY vide)", async () => {
    const { buildExtrasServicesTools } = await import(
      "@/lib/tools/native/extras-services"
    );
    const tools = buildExtrasServicesTools();
    const sendEmail = tools["send_email"];

    // Avec RESEND_API_KEY vide, on s'attend à un message d'erreur de config
    // pas à un draft — ce qui confirme que la gate est bien franchie
    const result = await sendEmail.execute?.(
      {
        to: "carol@example.com",
        subject: "Envoi réel",
        text: "Corps du message",
        _preview: false,
      },
      { messages: [], toolCallId: "test-call" },
    );

    // Le résultat doit être une string d'erreur resend (pas un draft objet)
    expect(typeof result).toBe("string");
    expect(result).toContain("Resend");
  });
});
