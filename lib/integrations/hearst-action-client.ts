/**
 * hearst-action-client — client HTTP pour HEARST.AI core/ (computer-use distant).
 *
 * L'API cible expose :
 *   POST {HEARST_ACTION_URL}/task
 *   Headers: x-api-key: {HEARST_ACTION_API_KEY}, x-tenant-id: {tenantId}
 *   Body:    { task: string, context?: object }
 *   Réponse: { ok: boolean, status: "blocked"|"confirmation_required"|"completed",
 *              reply?: string, result?: unknown, route?: object }
 *
 * Timeout côté serveur cible = 300s → JAMAIS d'await synchrone dans une route HTTP.
 * Ce client est appelé UNIQUEMENT depuis la fonction Inngest `computer-action-run`
 * (step.run durable, pas de limite Vercel de 120s).
 *
 * Fail-soft : JAMAIS de throw — retourne toujours { ok:false, error } en cas d'erreur.
 */

const ACTION_TIMEOUT_MS = 310_000; // légèrement au-delà du timeout serveur (300s)

function actionUrl(): string | null {
  const url = process.env.HEARST_ACTION_URL?.trim();
  return url ? url.replace(/\/$/, "") : null;
}

function apiKey(): string | null {
  return process.env.HEARST_ACTION_API_KEY?.trim() ?? null;
}

export type ComputerActionStatus = "blocked" | "confirmation_required" | "completed";

export interface ComputerActionResult {
  ok: boolean;
  status?: ComputerActionStatus;
  reply?: string;
  result?: unknown;
  route?: object;
  error?: string;
}

export interface SendComputerActionArgs {
  task: string;
  context?: Record<string, unknown>;
  tenantId: string;
}

/**
 * Envoie une action computer-use vers HEARST.AI core/.
 * Fail-soft : { ok:false, error } jamais de throw.
 */
export async function sendComputerAction(
  args: SendComputerActionArgs,
): Promise<ComputerActionResult> {
  const url = actionUrl();
  if (!url) return { ok: false, error: "not_configured" };

  const key = apiKey();
  if (!key) return { ok: false, error: "HEARST_ACTION_API_KEY absent" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ACTION_TIMEOUT_MS);

  try {
    const res = await fetch(`${url}/task`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "x-tenant-id": args.tenantId,
      },
      body: JSON.stringify({
        task: args.task,
        ...(args.context && Object.keys(args.context).length > 0 ? { context: args.context } : {}),
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ok: false, error: `HTTP ${res.status}: ${txt.slice(0, 120)}` };
    }

    const data = (await res.json()) as {
      ok?: boolean;
      status?: ComputerActionStatus;
      reply?: string;
      result?: unknown;
      route?: object;
    };

    return {
      ok: data.ok !== false,
      status: data.status,
      reply: data.reply,
      result: data.result,
      route: data.route,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.name : "unknown" };
  } finally {
    clearTimeout(timer);
  }
}
