/**
 * Validation Zod corps de requête — 22 routes API (OWASP API3:2023)
 *
 * Tests unitaires vérifiant que les schémas Zod rejettent correctement
 * les corps malformés, oversized, ou avec des clés inconnues (mass assignment).
 * On teste les schémas directement sans monter le serveur Next.
 */

import { describe, expect, it } from "vitest";
import { z } from "zod";

// ── Schémas répliqués pour les tests (sources vérité = les routes) ─────────

const analyticsBodySchema = z.object({
  type: z.enum(["login_success", "first_message_sent", "run_completed", "run_failed"]),
  userId: z.unknown().optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
}).strict();

const kgIngestBodySchema = z.object({
  text: z.string().min(1).max(50_000),
  sourceLabel: z.string().max(200).optional(),
}).strict();

const voiceToolCallBodySchema = z.object({
  name: z.string().min(1).max(200),
  args: z.record(z.string(), z.unknown()).optional().default({}),
  callId: z.string().max(200).optional(),
  sessionId: z.string().max(200).optional(),
  threadId: z.string().max(200).optional(),
}).strict();

const missionMessageBodySchema = z.object({
  content: z.string().min(1).max(10_000),
  role: z.enum(["user", "system"]).optional().default("user"),
}).strict();

const notificationReadSchema = z.object({
  id: z.string().uuid(),
}).strict();

const variantsBodySchema = z.object({
  kind: z.enum(["audio", "video", "slides", "site", "image"]),
  text: z.string().max(10_000).optional(),
  voiceId: z.string().max(200).optional(),
  modelId: z.string().max(200).optional(),
  provider: z.enum(["runway", "heygen"]).optional(),
  prompt: z.string().max(10_000).optional(),
  scriptText: z.string().max(10_000).optional(),
  avatarId: z.string().max(200).optional(),
  ratio: z.enum(["1280:720", "720:1280"]).optional(),
  derivedFrom: z.array(z.string().max(200)).max(20).optional(),
  duration: z.number().int().min(1).max(600).optional(),
  durationSeconds: z.union([z.literal(5), z.literal(10)]).optional(),
}).strict();

const transcriptsAppendBodySchema = z.object({
  sessionId: z.string().min(1).max(200),
  threadId: z.string().max(200).optional(),
  entry: z.object({
    id: z.string().min(1).max(200),
    role: z.enum(["user", "assistant", "tool_call", "tool_result"]),
    text: z.string().max(10_000),
    timestamp: z.number().int().optional(),
    toolName: z.string().max(200).optional(),
    callId: z.string().max(200).optional(),
    args: z.record(z.string(), z.unknown()).optional(),
    output: z.string().max(10_000).optional(),
    status: z.enum(["pending", "success", "error"]).optional(),
    providerId: z.string().max(200).optional(),
    stageRequest: z.unknown().optional(),
  }),
}).strict();

// ── Tests analytics ──────────────────────────────────────────────────────────

describe("POST /api/analytics — validation Zod", () => {
  it("accepte un body valide", () => {
    const r = analyticsBodySchema.safeParse({ type: "login_success" });
    expect(r.success).toBe(true);
  });

  it("rejette un type inconnu (mass assignment / injection event fictif)", () => {
    const r = analyticsBodySchema.safeParse({ type: "admin_override" });
    expect(r.success).toBe(false);
  });

  it("rejette un body vide", () => {
    const r = analyticsBodySchema.safeParse({});
    expect(r.success).toBe(false);
  });

  it("rejette des clés inconnues (.strict — empêche mass assignment)", () => {
    const r = analyticsBodySchema.safeParse({
      type: "login_success",
      admin: true,
    });
    expect(r.success).toBe(false);
  });

  it("rejette null", () => {
    const r = analyticsBodySchema.safeParse(null);
    expect(r.success).toBe(false);
  });
});

// ── Tests kg/ingest ──────────────────────────────────────────────────────────

describe("POST /api/v2/kg/ingest — validation Zod", () => {
  it("accepte un body valide", () => {
    const r = kgIngestBodySchema.safeParse({ text: "bonjour monde" });
    expect(r.success).toBe(true);
  });

  it("rejette un text vide", () => {
    const r = kgIngestBodySchema.safeParse({ text: "" });
    expect(r.success).toBe(false);
  });

  it("rejette un text qui dépasse 50 000 chars", () => {
    const r = kgIngestBodySchema.safeParse({ text: "a".repeat(50_001) });
    expect(r.success).toBe(false);
  });

  it("rejette des clés inconnues (.strict)", () => {
    const r = kgIngestBodySchema.safeParse({ text: "ok", userId: "inject" });
    expect(r.success).toBe(false);
  });

  it("rejette null", () => {
    const r = kgIngestBodySchema.safeParse(null);
    expect(r.success).toBe(false);
  });

  it("accepte avec sourceLabel optionnel", () => {
    const r = kgIngestBodySchema.safeParse({ text: "test", sourceLabel: "email" });
    expect(r.success).toBe(true);
  });
});

// ── Tests voice/tool-call ─────────────────────────────────────────────────────

describe("POST /api/v2/voice/tool-call — validation Zod", () => {
  it("accepte un body valide minimal", () => {
    const r = voiceToolCallBodySchema.safeParse({ name: "open_mission" });
    expect(r.success).toBe(true);
  });

  it("rejette un name vide", () => {
    const r = voiceToolCallBodySchema.safeParse({ name: "" });
    expect(r.success).toBe(false);
  });

  it("rejette un name dépassant 200 chars", () => {
    const r = voiceToolCallBodySchema.safeParse({ name: "x".repeat(201) });
    expect(r.success).toBe(false);
  });

  it("rejette des clés inconnues (.strict — empêche mass assignment)", () => {
    const r = voiceToolCallBodySchema.safeParse({
      name: "open_mission",
      userId: "hacked-id",
    });
    expect(r.success).toBe(false);
  });

  it("rejette null", () => {
    const r = voiceToolCallBodySchema.safeParse(null);
    expect(r.success).toBe(false);
  });

  it("injecte args vide par défaut si absent", () => {
    const r = voiceToolCallBodySchema.safeParse({ name: "open_mission" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.args).toEqual({});
  });

  it("rejette args non-object (array)", () => {
    const r = voiceToolCallBodySchema.safeParse({ name: "open_mission", args: [1, 2, 3] });
    expect(r.success).toBe(false);
  });
});

// ── Tests missions/[id]/messages ─────────────────────────────────────────────

describe("POST /api/v2/missions/[id]/messages — validation Zod", () => {
  it("accepte un body valide", () => {
    const r = missionMessageBodySchema.safeParse({ content: "Bonjour" });
    expect(r.success).toBe(true);
  });

  it("accepte role 'system'", () => {
    const r = missionMessageBodySchema.safeParse({ content: "msg", role: "system" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.role).toBe("system");
  });

  it("rejette role 'assistant' (injection de rôle non autorisé)", () => {
    const r = missionMessageBodySchema.safeParse({ content: "msg", role: "assistant" });
    expect(r.success).toBe(false);
  });

  it("rejette content vide", () => {
    const r = missionMessageBodySchema.safeParse({ content: "" });
    expect(r.success).toBe(false);
  });

  it("rejette content > 10 000 chars", () => {
    const r = missionMessageBodySchema.safeParse({ content: "x".repeat(10_001) });
    expect(r.success).toBe(false);
  });

  it("rejette des clés inconnues (.strict — empêche mass assignment)", () => {
    const r = missionMessageBodySchema.safeParse({ content: "ok", missionId: "stolen" });
    expect(r.success).toBe(false);
  });
});

// ── Tests notifications/read ──────────────────────────────────────────────────

describe("POST /api/notifications/read — validation Zod UUID", () => {
  it("accepte un UUID valide", () => {
    const r = notificationReadSchema.safeParse({ id: "550e8400-e29b-41d4-a716-446655440000" });
    expect(r.success).toBe(true);
  });

  it("rejette un id non-UUID (IDOR par string arbitraire)", () => {
    const r = notificationReadSchema.safeParse({ id: "../admin" });
    expect(r.success).toBe(false);
  });

  it("rejette un id vide", () => {
    const r = notificationReadSchema.safeParse({ id: "" });
    expect(r.success).toBe(false);
  });

  it("rejette des clés supplémentaires (.strict)", () => {
    const r = notificationReadSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      userId: "hacked",
    });
    expect(r.success).toBe(false);
  });
});

// ── Tests assets/[id]/variants — derivedFrom bombing ─────────────────────────

describe("POST /api/v2/assets/[id]/variants — validation Zod", () => {
  it("accepte un body audio valide", () => {
    const r = variantsBodySchema.safeParse({ kind: "audio" });
    expect(r.success).toBe(true);
  });

  it("rejette derivedFrom avec plus de 20 éléments (liste bombing)", () => {
    const r = variantsBodySchema.safeParse({
      kind: "video",
      derivedFrom: Array(21).fill("some-id"),
    });
    expect(r.success).toBe(false);
  });

  it("rejette un kind inconnu", () => {
    const r = variantsBodySchema.safeParse({ kind: "exploit" });
    expect(r.success).toBe(false);
  });

  it("rejette un prompt > 10 000 chars", () => {
    const r = variantsBodySchema.safeParse({ kind: "video", prompt: "x".repeat(10_001) });
    expect(r.success).toBe(false);
  });

  it("rejette des clés inconnues (.strict)", () => {
    const r = variantsBodySchema.safeParse({ kind: "audio", tenantId: "stolen" });
    expect(r.success).toBe(false);
  });
});

// ── Tests voice/transcripts/append ───────────────────────────────────────────

describe("POST /api/v2/voice/transcripts/append — validation Zod", () => {
  const validEntry = {
    sessionId: "session-abc",
    entry: {
      id: "entry-1",
      role: "user" as const,
      text: "bonjour",
    },
  };

  it("accepte un body valide", () => {
    const r = transcriptsAppendBodySchema.safeParse(validEntry);
    expect(r.success).toBe(true);
  });

  it("rejette role inconnu dans entry", () => {
    const r = transcriptsAppendBodySchema.safeParse({
      ...validEntry,
      entry: { ...validEntry.entry, role: "admin" },
    });
    expect(r.success).toBe(false);
  });

  it("rejette text entry > 10 000 chars", () => {
    const r = transcriptsAppendBodySchema.safeParse({
      ...validEntry,
      entry: { ...validEntry.entry, text: "x".repeat(10_001) },
    });
    expect(r.success).toBe(false);
  });

  it("rejette sessionId absent", () => {
    const r = transcriptsAppendBodySchema.safeParse({
      entry: validEntry.entry,
    });
    expect(r.success).toBe(false);
  });

  it("rejette clés inconnues au niveau racine (.strict)", () => {
    const r = transcriptsAppendBodySchema.safeParse({
      ...validEntry,
      userId: "injected",
    });
    expect(r.success).toBe(false);
  });
});
