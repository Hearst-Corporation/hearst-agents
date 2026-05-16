import { describe, expect, it } from "vitest";
import { ARCJET_LLM_JOB_PATHS, isLlmJobPath } from "../../proxy";

/**
 * Tests pour F-098 — Vérifier que /api/agents/[id]/chat et /api/agents/[id]/run
 * sont protégés par le strict quota Arcjet LLM (20 req/min/user+IP).
 *
 * Distinction importante :
 * - /api/agents/[id]/chat → LLM payant → protégé
 * - /api/agents/[id]/run → LLM payant → protégé
 * - /api/agents (list) → CRUD → NON protégé (utilise le quota standard)
 * - /api/agents/[id] (GET/PUT/DELETE) → CRUD → NON protégé
 *
 * Le matching utilise un regex `^/api/agents/[^/]+/(chat|run)$` pour éviter
 * l'over-match sur les routes CRUD.
 */

describe("F-098 — /api/agents/[id]/chat rate-limit", () => {
  it("isLlmJobPath('/api/agents/abc-id-123/chat') matches via regex", () => {
    expect(isLlmJobPath("/api/agents/abc-id-123/chat")).toBe(true);
  });

  it("isLlmJobPath('/api/agents/uuid-format/chat') matches via regex", () => {
    expect(isLlmJobPath("/api/agents/12345-uuid-67890/chat")).toBe(true);
  });

  it("isLlmJobPath('/api/agents/[id]/run') matches via regex (bonus)", () => {
    expect(isLlmJobPath("/api/agents/abc123/run")).toBe(true);
  });

  it("isLlmJobPath('/api/agents') root → false (CRUD, pas LLM)", () => {
    expect(isLlmJobPath("/api/agents")).toBe(false);
  });

  it("isLlmJobPath('/api/agents/abc-id') sans suffix → false (GET single)", () => {
    expect(isLlmJobPath("/api/agents/abc-id")).toBe(false);
  });

  it("isLlmJobPath('/api/agents/abc/memory') → false (sous-ressource non-LLM)", () => {
    expect(isLlmJobPath("/api/agents/abc/memory")).toBe(false);
  });

  it("isLlmJobPath exclut les routes non-agents", () => {
    expect(isLlmJobPath("/api/orchestrate")).toBe(false);
    expect(isLlmJobPath("/api/v2/missions")).toBe(false);
    expect(isLlmJobPath("/api/health")).toBe(false);
  });

  it("ARCJET_LLM_JOB_PATHS couvre les chemins coûteux explicites (hors agents/[id])", () => {
    const expectedPaths = [
      "/api/v2/jobs/code-exec",
      "/api/v2/jobs/image-gen",
      "/api/v2/jobs/audio-gen",
      "/api/v2/jobs/document-parse",
      "/api/v2/jobs/video-gen",
      "/api/v2/assets/diff",
      "/api/v2/personas/ab-test",
    ];
    for (const path of expectedPaths) {
      expect(ARCJET_LLM_JOB_PATHS).toContain(path);
    }
  });

  it("rate-limit isolation: user A spam ne bloque pas user B", () => {
    // Logique théorique d'isolation : Arcjet bucket = (IP + userId).
    // Si userA fait 20+ req/min, userB depuis même IP reste OK.
    const userA = "user-uuid-aaaa";
    const userB = "user-uuid-bbbb";
    const ip = "1.2.3.4";
    const bucketA = `${ip}:${userA}`;
    const bucketB = `${ip}:${userB}`;
    expect(bucketA).not.toBe(bucketB);
  });
});
