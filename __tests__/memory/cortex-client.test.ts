/**
 * cortex-client — tests unitaires pour pushArtifactToCortex et searchCortexMemory.
 *
 * Couvre :
 *   - pushArtifactToCortex (swarm + action) : URL, HMAC, body structure
 *   - skip propre quand env absente ou result vide
 *   - filtre searchCortexMemory : source "helm" exclu, "helm-swarm"/"helm-action" gardés,
 *     path-based exclude supprimé (artefacts avec path "helm/swarm/xxx.md" passent)
 */

import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pushArtifactToCortex, searchCortexMemory } from "@/lib/memory/cortex-client";

// ── helpers ──────────────────────────────────────────────────────────────────

function hmacSha256(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

// ── fetch mock global ─────────────────────────────────────────────────────────

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) } as Response);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ── pushArtifactToCortex — swarm ──────────────────────────────────────────────

describe("pushArtifactToCortex — swarm", () => {
  beforeEach(() => {
    vi.stubEnv("CORTEX_URL", "https://cortex.hearst.app");
    vi.stubEnv("HELM_WEBHOOK_SECRET", "test-secret-swarm");
  });

  it("appelle le bon endpoint avec HMAC et body structuré", async () => {
    const result = await pushArtifactToCortex({
      kind: "swarm",
      task: "Analyse du marché crypto",
      result: "Le marché est haussier.",
      userId: "user-123",
      tenantId: "tenant-abc",
      runId: "run-xyz",
      extraMeta: { swarmId: "s1", engineRunId: "e1" },
    });

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://cortex.hearst.app/api/ingest/helm");

    // HMAC correct
    const body = options.body as string;
    const expectedSig = hmacSha256(body, "test-secret-swarm");
    const headers = options.headers as Record<string, string>;
    expect(headers["x-helm-signature"]).toBe(expectedSig);

    // Structure du body
    const parsed = JSON.parse(body) as {
      event: string;
      payload: {
        source: string;
        task: string;
        result: string;
        user_id: string;
        tenant_id: string;
        run_id: string;
        meta: Record<string, unknown>;
      };
    };
    expect(parsed.event).toBe("memory.swarm_result");
    expect(parsed.payload.source).toBe("helm-swarm");
    expect(parsed.payload.task).toBe("Analyse du marché crypto");
    expect(parsed.payload.result).toBe("Le marché est haussier.");
    expect(parsed.payload.user_id).toBe("user-123");
    expect(parsed.payload.tenant_id).toBe("tenant-abc");
    expect(parsed.payload.run_id).toBe("run-xyz");
    expect(parsed.payload.meta).toEqual({ swarmId: "s1", engineRunId: "e1" });
  });

  it("slice task à 500 chars et result à 8000 chars", async () => {
    const longTask = "T".repeat(600);
    const longResult = "R".repeat(9000);

    await pushArtifactToCortex({
      kind: "swarm",
      task: longTask,
      result: longResult,
      userId: "u",
      tenantId: "t",
    });

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const parsed = JSON.parse(options.body as string) as {
      payload: { task: string; result: string };
    };
    expect(parsed.payload.task.length).toBe(500);
    expect(parsed.payload.result.length).toBe(8000);
  });
});

// ── pushArtifactToCortex — action ─────────────────────────────────────────────

describe("pushArtifactToCortex — action", () => {
  beforeEach(() => {
    vi.stubEnv("CORTEX_URL", "https://cortex.hearst.app");
    vi.stubEnv("HELM_WEBHOOK_SECRET", "test-secret-action");
  });

  it("event = memory.action_result, source = helm-action", async () => {
    await pushArtifactToCortex({
      kind: "action",
      task: "Ouvre Gmail et liste les emails non lus",
      result: "J'ai trouvé 3 emails non lus.",
      userId: "user-456",
      tenantId: "tenant-def",
      extraMeta: { actionStatus: "completed", route: "/gmail" },
    });

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://cortex.hearst.app/api/ingest/helm");

    const parsed = JSON.parse(options.body as string) as {
      event: string;
      payload: {
        source: string;
        user_id: string;
        tenant_id: string;
        task: string;
        result: string;
      };
    };
    expect(parsed.event).toBe("memory.action_result");
    expect(parsed.payload.source).toBe("helm-action");
    expect(parsed.payload.user_id).toBe("user-456");
    expect(parsed.payload.tenant_id).toBe("tenant-def");
    expect(parsed.payload.task).toBe("Ouvre Gmail et liste les emails non lus");
    expect(parsed.payload.result).toBe("J'ai trouvé 3 emails non lus.");
  });
});

// ── pushArtifactToCortex — skip si env absente ou result vide ─────────────────

describe("pushArtifactToCortex — guard skip", () => {
  it("retourne false et n'appelle pas fetch si CORTEX_URL absent", async () => {
    vi.stubEnv("CORTEX_URL", "");
    vi.stubEnv("HELM_WEBHOOK_SECRET", "secret");

    const result = await pushArtifactToCortex({
      kind: "swarm",
      task: "test",
      result: "résultat",
      userId: "u",
      tenantId: "t",
    });

    expect(result).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retourne false et n'appelle pas fetch si HELM_WEBHOOK_SECRET absent", async () => {
    vi.stubEnv("CORTEX_URL", "https://cortex.hearst.app");
    vi.stubEnv("HELM_WEBHOOK_SECRET", "");

    const result = await pushArtifactToCortex({
      kind: "action",
      task: "test",
      result: "résultat",
      userId: "u",
      tenantId: "t",
    });

    expect(result).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retourne false si result vide (whitespace)", async () => {
    vi.stubEnv("CORTEX_URL", "https://cortex.hearst.app");
    vi.stubEnv("HELM_WEBHOOK_SECRET", "secret");

    const result = await pushArtifactToCortex({
      kind: "swarm",
      task: "test",
      result: "   ",
      userId: "u",
      tenantId: "t",
    });

    expect(result).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ── searchCortexMemory — filtre anti-boucle C3 allégé ────────────────────────

describe("searchCortexMemory — filtre source (anti-boucle C3 allégé)", () => {
  beforeEach(() => {
    vi.stubEnv("CORTEX_URL", "https://cortex.hearst.app");
    vi.stubEnv("CORTEX_PUBLIC_API_KEY", "pk-test");
  });

  it("exclut source=helm (chat-turns), garde helm-swarm et helm-action", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          {
            source: "helm",
            path: "helm/2026-05-23-turn.md",
            content_preview: "tour de chat",
            score: 0.9,
          },
          {
            source: "helm-swarm",
            path: "helm/swarm/2026-05-23-swarm.md",
            content_preview: "résultat swarm",
            score: 0.8,
          },
          {
            source: "helm-action",
            path: "helm/action/2026-05-23-act.md",
            content_preview: "résultat action",
            score: 0.7,
          },
        ],
      }),
    } as Response);

    const results = await searchCortexMemory({ query: "marché crypto" });

    // source="helm" exclus, les deux autres gardés
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.textExcerpt)).toEqual(
      expect.arrayContaining(["résultat swarm", "résultat action"]),
    );
  });

  it("garde un résultat sans source mais avec path helm/swarm/... (path-based exclude supprimé)", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          // Pas de champ source → ne doit PAS être exclu (le path-guard est retiré)
          { path: "helm/swarm/2026-05-23-old.md", content_preview: "ancien artefact", score: 0.75 },
        ],
      }),
    } as Response);

    const results = await searchCortexMemory({ query: "ancien artefact swarm" });

    expect(results).toHaveLength(1);
    expect(results[0].textExcerpt).toBe("ancien artefact");
  });

  it("exclut source=helm même si path ne contient pas 'helm/'", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          {
            source: "helm",
            path: "00_Inbox/some-note.md",
            content_preview: "turn helm",
            score: 0.85,
          },
        ],
      }),
    } as Response);

    const results = await searchCortexMemory({ query: "turn helm" });

    expect(results).toHaveLength(0);
  });
});
