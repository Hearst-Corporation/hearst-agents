/**
 * POST /api/v2/personas/ab-test
 *
 * Body : { message: string, personaIdA: string, personaIdB: string }
 * Lance 2 appels LLM en parallèle avec deux personas différentes pour
 * comparer la voix produite. Pas d'historique, pas d'outils — la valeur
 * comparée est la voix sur un message simple.
 *
 * Fail-soft : si Kimi n'est pas configuré, on renvoie 503.
 */

import { type NextRequest, NextResponse } from "next/server";
import { abTestPersonaSchema } from "@/lib/contracts/personas";
import { guardAndReserveCredits } from "@/lib/credits/client";
import { KIMI_MODELS } from "@/lib/llm/models";
import { chatWithCircuitBreaker } from "@/lib/llm/safe-chat";
import { getPersonaById } from "@/lib/personas/store";
import { buildPersonaAddonOrNull } from "@/lib/personas/system-prompt-addon";
import { requireScope } from "@/lib/platform/auth/scope";
import { parseJsonBody } from "@/lib/platform/http/parse-body";

export const dynamic = "force-dynamic";

const MODEL = KIMI_MODELS.HAIKU;
const MAX_TOKENS = 800;

interface RunOk {
  ok: true;
  text: string;
  latencyMs: number;
}
interface RunFail {
  ok: false;
}

async function runOne(opts: {
  systemPrompt: string;
  message: string;
  tenantId: string;
}): Promise<RunOk | RunFail> {
  const t0 = Date.now();
  return chatWithCircuitBreaker<RunOk | RunFail>({
    tenantId: opts.tenantId,
    context: "personas/ab-test",
    chatRequest: {
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: "system", content: opts.systemPrompt },
        { role: "user", content: opts.message },
      ],
    },
    fallback: { ok: false },
    parse: (res) => ({
      ok: true as const,
      text: (res.content || "").trim(),
      latencyMs: Date.now() - t0,
    }),
  });
}

export async function POST(req: NextRequest) {
  const { scope, error } = await requireScope({
    context: "POST /api/v2/personas/ab-test",
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  const parsed = await parseJsonBody(req, abTestPersonaSchema);
  if (!parsed.ok) return parsed.response;
  const message = parsed.data.message.trim();
  const { personaIdA, personaIdB } = parsed.data;

  const [pA, pB] = await Promise.all([
    getPersonaById(personaIdA, {
      userId: scope!.userId,
      tenantId: scope!.tenantId,
    }),
    getPersonaById(personaIdB, {
      userId: scope!.userId,
      tenantId: scope!.tenantId,
    }),
  ]);

  if (!pA) {
    return NextResponse.json(
      { error: "persona_not_found", which: "A", id: personaIdA },
      { status: 404 },
    );
  }
  if (!pB) {
    return NextResponse.json(
      { error: "persona_not_found", which: "B", id: personaIdB },
      { status: 404 },
    );
  }

  const baseSystem =
    "Tu es Hearst, assistant exécutif. Réponds en français, format scannable. " + "Pas d'emoji.";
  const addonA = buildPersonaAddonOrNull(pA);
  const addonB = buildPersonaAddonOrNull(pB);
  const sysA = addonA ? `${baseSystem}\n\n${addonA}` : baseSystem;
  const sysB = addonB ? `${baseSystem}\n\n${addonB}` : baseSystem;

  if (!process.env.KIMI_API_KEY) {
    return NextResponse.json(
      { error: "llm_unavailable", message: "KIMI_API_KEY non configuré." },
      { status: 503 },
    );
  }

  // Budget tenant — 2 appels parallèles → coût × 2, fail-closed avant LLM
  const jobId = `ab-test-${personaIdA}-${personaIdB}-${Date.now()}`;
  const creditGuard = await guardAndReserveCredits({
    userId: scope!.userId,
    tenantId: scope!.tenantId,
    estimatedCostUsd: 0.1, // 2 × 0.05 upper bound
    jobId,
    jobKind: "simulation",
  });
  if (!creditGuard.allowed) {
    return NextResponse.json(
      {
        error: "insufficient_credits",
        reason: creditGuard.reason,
        availableUsd: creditGuard.availableUsd,
      },
      { status: 402 },
    );
  }

  const [resA, resB] = await Promise.all([
    runOne({ systemPrompt: sysA, message, tenantId: scope!.tenantId }),
    runOne({ systemPrompt: sysB, message, tenantId: scope!.tenantId }),
  ]);

  if (!resA.ok || !resB.ok) {
    return NextResponse.json(
      {
        error: "llm_unavailable",
        message: "Kimi indisponible (circuit ouvert ou erreur LLM) pour au moins une persona.",
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    message,
    a: { persona: pA, response: resA.text, latencyMs: resA.latencyMs },
    b: { persona: pB, response: resB.text, latencyMs: resB.latencyMs },
  });
}
