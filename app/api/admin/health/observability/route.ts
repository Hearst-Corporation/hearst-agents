/**
 * GET /api/admin/health/observability — santé des couches d'observabilité.
 *
 * P1-1 : permet à l'admin/ops de détecter rapidement quand Langfuse / Sentry
 * sont mal configurés en prod. Renvoie 200 si toutes les couches sont OK,
 * 503 si au moins une est dégradée.
 *
 * Vérifie :
 *  - Langfuse : client instancié (clés présentes) + flush ping
 *  - Sentry : DSN configuré
 *  - Axiom : token configuré (optionnel, log-only)
 *
 * RBAC : `settings.read` (admin only).
 */

import { NextResponse } from "next/server";
import { flushLangfuse, getLangfuseClient } from "@/lib/observability/langfuse";
import { isError, requireAdmin } from "../../_helpers";

export const dynamic = "force-dynamic";

interface ObservabilityCheck {
  name: "langfuse" | "sentry" | "axiom";
  ok: boolean;
  configured: boolean;
  /** Détail user-facing court ; ne JAMAIS exposer de secrets. */
  detail: string;
  /** Latence ping en ms si applicable (Langfuse flush ping). */
  latencyMs?: number;
}

async function checkLangfuse(): Promise<ObservabilityCheck> {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const configured = Boolean(publicKey && secretKey);

  if (!configured) {
    return {
      name: "langfuse",
      configured: false,
      ok: false,
      detail: "LANGFUSE_PUBLIC_KEY/SECRET_KEY absents",
    };
  }

  // Tente d'instancier le client + ping flush. Si la couche réseau est down
  // côté Langfuse, flushLangfuse retourne false dans son timeout (2s).
  const t0 = Date.now();
  try {
    const client = getLangfuseClient();
    if (!client) {
      return {
        name: "langfuse",
        configured: true,
        ok: false,
        detail: "client init returned null",
      };
    }
    const flushed = await flushLangfuse(1500);
    return {
      name: "langfuse",
      configured: true,
      ok: flushed,
      detail: flushed ? "client ready, flush ping OK" : "flush ping timeout (network slow ?)",
      latencyMs: Date.now() - t0,
    };
  } catch (err) {
    return {
      name: "langfuse",
      configured: true,
      ok: false,
      detail: `init error: ${err instanceof Error ? err.message : String(err)}`,
      latencyMs: Date.now() - t0,
    };
  }
}

function checkSentry(): ObservabilityCheck {
  const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
  const configured = Boolean(dsn);
  return {
    name: "sentry",
    configured,
    ok: configured,
    detail: configured ? "DSN configured" : "SENTRY_DSN absent",
  };
}

function checkAxiom(): ObservabilityCheck {
  const token = process.env.AXIOM_TOKEN;
  const configured = Boolean(token);
  return {
    name: "axiom",
    configured,
    // Axiom est optionnel — ok=true si non configuré (pas un signal de prod
    // dégradée). En prod, on attend qu'il soit configuré pour les logs.
    ok: configured || process.env.NODE_ENV !== "production",
    detail: configured ? "AXIOM_TOKEN configured" : "AXIOM_TOKEN absent (logs limited)",
  };
}

export async function GET() {
  const guard = await requireAdmin("GET /api/admin/health/observability", {
    resource: "settings",
    action: "read",
  });
  if (isError(guard)) return guard;

  const [langfuse, sentry, axiom] = await Promise.all([
    checkLangfuse(),
    Promise.resolve(checkSentry()),
    Promise.resolve(checkAxiom()),
  ]);

  const checks = [langfuse, sentry, axiom];
  const allOk = checks.every((c) => c.ok);
  const status = allOk ? "ok" : "degraded";
  const httpStatus = allOk ? 200 : 503;

  return NextResponse.json(
    {
      status,
      checks,
      checkedAt: new Date().toISOString(),
    },
    { status: httpStatus },
  );
}
