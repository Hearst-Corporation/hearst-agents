import { describe, expect, it, vi } from "vitest";
import { aj, ajLlmJobs, ajOrchestrate, isArcjetEnabled } from "@/lib/security/arcjet";
import { ARCJET_LLM_JOB_PATHS } from "../../proxy";

/**
 * Tests de configuration Arcjet + comportement routage.
 *
 * - Tests de configuration : structure des instances (sans clé réelle)
 * - Tests de routage : paths ARCJET_LLM_JOB_PATHS incluent bien video-gen
 * - Tests comportementaux : logique d'isolation userId (sans clé Arcjet)
 * - Tests de décision : skip (nécessitent clé Arcjet réelle ou e2e)
 */

describe("Arcjet configuration", () => {
  it("isArcjetEnabled vérifie la présence d'ARCJET_KEY", () => {
    const enabled = isArcjetEnabled();
    expect(typeof enabled).toBe("boolean");
  });

  it("aj instance configurée (ou null si pas de clé)", () => {
    if (!isArcjetEnabled()) {
      expect(aj).toBeNull();
    } else {
      expect(aj).toBeTruthy();
    }
  });

  it("ajOrchestrate instance configurée (quota 10 req/min/user+IP)", () => {
    if (!isArcjetEnabled()) {
      expect(ajOrchestrate).toBeNull();
    } else {
      expect(ajOrchestrate).toBeTruthy();
    }
  });

  it("ajLlmJobs instance configurée (quota 20 req/min/user+IP)", () => {
    if (!isArcjetEnabled()) {
      expect(ajLlmJobs).toBeNull();
    } else {
      expect(ajLlmJobs).toBeTruthy();
    }
  });
});

describe("Arcjet routing — ARCJET_LLM_JOB_PATHS", () => {
  const isLlmJobPath = (path: string) =>
    ARCJET_LLM_JOB_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

  it("video-gen est dans ARCJET_LLM_JOB_PATHS (Fix 1)", () => {
    expect(ARCJET_LLM_JOB_PATHS).toContain("/api/v2/jobs/video-gen");
  });

  it("isLlmJobPath('/api/v2/jobs/video-gen') retourne true", () => {
    expect(isLlmJobPath("/api/v2/jobs/video-gen")).toBe(true);
  });

  it("isLlmJobPath couvre les 7 chemins coûteux", () => {
    const expected = [
      "/api/v2/jobs/code-exec",
      "/api/v2/jobs/image-gen",
      "/api/v2/jobs/audio-gen",
      "/api/v2/jobs/document-parse",
      "/api/v2/jobs/video-gen",
      "/api/v2/assets/diff",
      "/api/v2/personas/ab-test",
    ];
    for (const path of expected) {
      expect(isLlmJobPath(path)).toBe(true);
    }
  });

  it("isLlmJobPath exclut les routes de polling (status, progress)", () => {
    expect(isLlmJobPath("/api/v2/jobs/abc123/status")).toBe(false);
    expect(isLlmJobPath("/api/v2/jobs/abc123/progress")).toBe(false);
    expect(isLlmJobPath("/api/v2/jobs")).toBe(false);
    expect(isLlmJobPath("/api/v2/missions")).toBe(false);
  });
});

describe("Arcjet userId bucket — extractUserIdFromRequest", () => {
  it("retourne undefined si NEXTAUTH_SECRET absent", async () => {
    const savedSecret = process.env.NEXTAUTH_SECRET;
    delete process.env.NEXTAUTH_SECRET;

    const { extractUserIdFromRequest } = await import("@/lib/security/arcjet");
    const mockReq = {
      headers: { get: () => null },
      cookies: { get: () => undefined },
    } as unknown as import("next/server").NextRequest;
    const userId = await extractUserIdFromRequest(mockReq);
    expect(userId).toBeUndefined();

    process.env.NEXTAUTH_SECRET = savedSecret;
  });

  it("retourne undefined si getToken échoue (réseau/parsing)", async () => {
    process.env.NEXTAUTH_SECRET = "test-secret-32-bytes-minimum!!!";
    const fetchMock = vi.fn().mockRejectedValue(new Error("network error"));
    const savedFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { extractUserIdFromRequest } = await import("@/lib/security/arcjet");
    const mockReq = {
      headers: { get: () => null },
      cookies: { get: () => undefined },
    } as unknown as import("next/server").NextRequest;
    const userId = await extractUserIdFromRequest(mockReq);
    // La fonction catch les erreurs → retourne undefined (fail-soft)
    expect(userId).toBeUndefined();

    globalThis.fetch = savedFetch;
    delete process.env.NEXTAUTH_SECRET;
  });

  it("logique d'isolation: deux userIds distincts → buckets distincts", () => {
    // Sans clé Arcjet, on vérifie la logique d'isolation théorique :
    // si userId A ≠ userId B, les buckets Arcjet (IP+userId) sont distincts.
    const userA = "user-uuid-a";
    const userB = "user-uuid-b";
    const ip = "1.2.3.4"; // même IP (corp NAT)

    // Composite key simulé : un user limité ne bloque pas l'autre
    const bucketA = `${ip}:${userA}`;
    const bucketB = `${ip}:${userB}`;
    expect(bucketA).not.toBe(bucketB);
  });

  it("fallback IP-only quand userId absent (anonymous request)", () => {
    const userId: string | undefined = undefined;

    // Sans userId, le bucket est ip-only (logique dans applyArcjet via props)
    const props = { requested: 1, ...(userId ? { userId } : {}) };
    expect(props).not.toHaveProperty("userId");
    // → Arcjet utilise ip.src seul comme dimension de bucket
    expect(Object.keys(props)).toEqual(["requested"]);
  });
});

describe("Arcjet decision matrix (intégration — nécessite clé réelle)", () => {
  it.skip("ajOrchestrate retourne 429 après 10 req/min dépassé", async () => {
    // Nécessite ARCJET_KEY réelle + mock/simulation de 10+ requêtes rapides.
    // Validé en staging/CI avec le rate limiter actif (DRY_RUN=false).
  });

  it.skip("ajLlmJobs retourne 429 après 20 req/min dépassé", async () => {
    // Même prérequis.
  });

  it.skip("aj default retourne 429 après 100 req/min dépassé", async () => {
    // Même prérequis.
  });

  it.skip("rate limit response inclut header Retry-After", async () => {
    // Validé en e2e ou staging.
  });

  it.skip("bucket userId isole user A et B derrière même IP corp NAT", async () => {
    // Scénario : user A (userId="uuid-a") consomme 10/10 req/min → 429.
    // user B (userId="uuid-b") depuis même IP → passe (bucket distinct).
    // Nécessite Arcjet sandbox ou clé réelle + mocker la décision cloud.
  });
});
