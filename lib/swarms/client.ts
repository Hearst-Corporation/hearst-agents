/**
 * swarms/client — client du moteur hive-engine (swarms CrewAI sur GPU2).
 *
 * Le moteur expose :
 *   POST /v1/swarms/{id}/kickoff          → { run_id, status:"running" }  (202)
 *   GET  /v1/swarms/{id}/status/{runId}   → { status, result_text, total_tokens_* }
 *   (⚠️ /v1/runs/{runId} existe mais ne persiste pas les runs des swarms slug —
 *    toujours poller via /v1/swarms/{swarmId}/status/{runId} avec l'UUID.)
 *
 * Un swarm tourne 4-8 min → JAMAIS d'await synchrone dans une route HTTP.
 * Ce client est appelé depuis la fonction Inngest `swarm-run` (durable).
 *
 * Auth : Bearer CREWAI_ENGINE_AUTH_TOKEN (vérifié hmac.compare_digest côté moteur).
 */

const DEFAULT_BASE_URL = "https://swarms.hearst.app";
const KICKOFF_TIMEOUT_MS = 15_000;
const POLL_TIMEOUT_MS = 10_000;

function baseUrl(): string {
  // CREWAI_ENGINE_URL peut pointer localhost en dev → on force swarms.hearst.app
  // si l'URL configurée n'est pas joignable depuis Vercel (http://127.*).
  const configured = process.env.CREWAI_ENGINE_URL?.trim();
  if (configured && !configured.startsWith("http://127") && !configured.includes("localhost")) {
    return configured.replace(/\/$/, "");
  }
  return DEFAULT_BASE_URL;
}

function authToken(): string | null {
  return process.env.CREWAI_ENGINE_AUTH_TOKEN ?? process.env.CREWAI_API_KEY ?? null;
}

export interface SwarmKickoffResult {
  ok: boolean;
  runId?: string;
  error?: string;
}

export interface SwarmStatusResult {
  ok: boolean;
  status?: "running" | "completed" | "failed" | string;
  resultText?: string;
  tokensIn?: number;
  tokensOut?: number;
  error?: string;
}

/**
 * Lance un swarm. Retourne le run_id du moteur (à poller ensuite).
 * Fail-soft : { ok:false, error } jamais de throw.
 */
export async function kickoffSwarm(
  swarmId: string,
  context: Record<string, unknown> = {},
): Promise<SwarmKickoffResult> {
  const token = authToken();
  if (!token) return { ok: false, error: "CREWAI_ENGINE_AUTH_TOKEN absent" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), KICKOFF_TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl()}/v1/swarms/${encodeURIComponent(swarmId)}/kickoff`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ context }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ok: false, error: `kickoff HTTP ${res.status}: ${txt.slice(0, 120)}` };
    }
    const data = (await res.json()) as { run_id?: string };
    if (!data.run_id) return { ok: false, error: "kickoff sans run_id" };
    return { ok: true, runId: data.run_id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.name : "unknown" };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Interroge le statut/résultat d'un run de swarm via
 * GET /v1/swarms/{swarmId}/status/{runId} (endpoint fiable, contrairement à
 * /v1/runs/{runId} qui ne persiste pas les runs des swarms par slug).
 * Fail-soft : { ok:false } jamais de throw.
 */
export async function getSwarmRun(swarmId: string, runId: string): Promise<SwarmStatusResult> {
  const token = authToken();
  if (!token) return { ok: false, error: "CREWAI_ENGINE_AUTH_TOKEN absent" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), POLL_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${baseUrl()}/v1/swarms/${encodeURIComponent(swarmId)}/status/${encodeURIComponent(runId)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      },
    );
    if (!res.ok) return { ok: false, error: `status HTTP ${res.status}` };
    const data = (await res.json()) as {
      status?: string;
      result_text?: string;
      total_tokens_in?: number;
      total_tokens_out?: number;
    };
    return {
      ok: true,
      status: data.status,
      resultText: data.result_text,
      tokensIn: data.total_tokens_in,
      tokensOut: data.total_tokens_out,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.name : "unknown" };
  } finally {
    clearTimeout(timer);
  }
}
