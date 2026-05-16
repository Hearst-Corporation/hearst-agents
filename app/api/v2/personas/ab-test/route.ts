/**
 * POST /api/v2/personas/ab-test
 *
 * Body : { message: string, personaIdA: string, personaIdB: string }
 * Lance 2 appels LLM en parallèle avec deux personas différentes pour
 * comparer la voix produite. Pas d'historique, pas d'outils — la valeur
 * comparée est la voix sur un message simple.
 *
 * Fail-soft : si Anthropic n'est pas configuré, on renvoie 503.
 */

import { type NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { abTestPersonaSchema } from "@/lib/contracts/personas";
import { getPersonaById } from "@/lib/personas/store";
import { buildPersonaAddonOrNull } from "@/lib/personas/system-prompt-addon";
import { requireScope } from "@/lib/platform/auth/scope";

export const dynamic = "force-dynamic";

const MODEL = "kimi-k2.5";
const MAX_TOKENS = 800;

async function runOne(opts: {
  client: OpenAI;
  systemPrompt: string;
  message: string;
}): Promise<{ text: string; latencyMs: number }> {
  const t0 = Date.now();
  const res = await opts.client.chat.completions.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [
      { role: "system", content: opts.systemPrompt },
      { role: "user", content: opts.message },
    ],
  });
  const text = (res.choices[0]?.message?.content || "").trim();
  return { text, latencyMs: Date.now() - t0 };
}

export async function POST(req: NextRequest) {
  const { scope, error } = await requireScope({
    context: "POST /api/v2/personas/ab-test",
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = abTestPersonaSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const message = parsed.data.message.trim();
  const { personaIdA, personaIdB } = parsed.data;

  const [pA, pB] = await Promise.all([
    getPersonaById(personaIdA, {
      userId: scope.userId,
      tenantId: scope.tenantId,
    }),
    getPersonaById(personaIdB, {
      userId: scope.userId,
      tenantId: scope.tenantId,
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

  const apiKey = process.env.KIMI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "llm_unavailable", message: "KIMI_API_KEY non configuré." },
      { status: 503 },
    );
  }

  const client = new OpenAI({ apiKey, baseURL: "https://api.hypercli.com/v1" });
  try {
    const [resA, resB] = await Promise.all([
      runOne({ client, systemPrompt: sysA, message }),
      runOne({ client, systemPrompt: sysB, message }),
    ]);

    return NextResponse.json({
      message,
      a: { persona: pA, response: resA.text, latencyMs: resA.latencyMs },
      b: { persona: pB, response: resB.text, latencyMs: resB.latencyMs },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "ab_test_failed";
    console.warn("[ab-test] failed:", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
