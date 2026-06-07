/**
 * lite-agent.ts — Stream E : fast-path LLM léger pour lectures simples mono-tool.
 *
 * PRINCIPE (3 étapes) :
 *   1. classify+resolve : 1 appel K2.5 avec prompt compact (message + liste des
 *      apps connectées + leurs READ actions en noms seulement, JAMAIS les schémas).
 *      Répond en JSON strict `{ slug, args }` ou `{ fallback: true }`.
 *   2. execute : executeComposioAction direct sur le slug résolu.
 *   3. summarize : 1 appel K2.5, résultat brut + message → prose FR/EN.
 *
 * GARDE-FOUS :
 *   - Reads only : tout slug write (CREATE/SEND/DELETE/UPDATE/…) → null.
 *   - Fail-soft TOTAL : aucun throw ne remonte (try/catch → null).
 *   - Aucun schéma de tool injecté dans les prompts K2.5 (noms seulement) → cheap.
 *   - Activé par défaut (opt-out) ; kill-switch `HELM_COMPOSIO_LITE_AGENT=0`.
 *
 * FEATURE FLAG : `process.env.HELM_COMPOSIO_LITE_AGENT !== "0"` (défaut ON, opt-out).
 * Quand =0 → ce module n'est jamais appelé, comportement = pipeline complet.
 */

import { executeComposioAction } from "@/lib/connectors/composio/client";
import { listConnections } from "@/lib/connectors/composio/connections";
import { ESSENTIAL_READS } from "@/lib/connectors/composio/discovery";
import { resolveConversationalFastpathConfig } from "@/lib/engine/orchestrator/conversational-fastpath";
import { chatWithCircuitBreaker } from "@/lib/llm/safe-chat";
import { logger } from "@/lib/observability/logger";

export interface LiteAgentResult {
  text: string;
  slug: string;
}

// ── Write-guard : slugs dont le segment post-prefix correspond à une écriture ─
// On rejette TOUT slug dont le nom contient un de ces verbes,
// indépendamment de ce que K2.5 a inféré.
const WRITE_VERB_RE =
  /\b(CREATE|SEND|DELETE|UPDATE|EDIT|MODIFY|ADD|REMOVE|ARCHIVE|FORWARD|REPLY|DRAFT|SCHEDULE|BOOK|CANCEL|MOVE|RENAME|SHARE|REVOKE|PUBLISH|SUBMIT|POST|PATCH|INSERT|UPSERT|RESET|CLEAR)\b/;

function isWriteSlug(slug: string): boolean {
  return WRITE_VERB_RE.test(slug.toUpperCase());
}

// ── Construction de la liste compacte des read actions ─────────────────────
// Pour chaque app active, on ne liste que les slugs de ESSENTIAL_READS.
// Si l'app n'est pas dans le registre, on la liste sans actions (skip silencieux).
// Format ligne : "  - APP_NAME: ACTION_SLUG_1, ACTION_SLUG_2"
function buildReadActionsCompact(activeSlugs: string[]): {
  lines: string;
  allReadSlugs: Set<string>;
} {
  const allReadSlugs = new Set<string>();
  const lines: string[] = [];

  for (const appSlug of activeSlugs) {
    const reads = ESSENTIAL_READS[appSlug];
    if (!reads || reads.length === 0) continue;
    reads.forEach((s) => allReadSlugs.add(s.toUpperCase()));
    lines.push(`  - ${appSlug.toUpperCase()}: ${reads.join(", ")}`);
  }

  return { lines: lines.join("\n"), allReadSlugs };
}

// ── Prompt classify+resolve ────────────────────────────────────────────────
function buildClassifyPrompt(message: string, compactList: string): string {
  return `You are a JSON-only tool router. Given a user message and a list of available READ actions, output EXACTLY one of:
  - { "slug": "ACTION_SLUG", "args": { ...params } }  — if this is a simple single-tool READ request
  - { "fallback": true }  — if it involves a write, multiple steps, context from history, or is ambiguous

Rules:
- Output ONLY valid JSON. No explanation, no markdown, no prose.
- Only use slugs from the list below. Never invent slugs.
- If the user asks to write, send, create, delete, update, reply, schedule, or modify anything → { "fallback": true }
- If the request needs conversation history or context → { "fallback": true }
- If unclear or not a simple read → { "fallback": true }
- args must match what the action realistically needs (e.g. max_results for email fetches).

Available READ actions per connected app:
${compactList}

User message: ${message.slice(0, 500)}`;
}

// ── Prompt summarize ───────────────────────────────────────────────────────
function buildSummarizePrompt(message: string, rawResult: string): string {
  return `You are a helpful assistant. The user asked: "${message.slice(0, 300)}"

Here is the raw data retrieved:
${rawResult.slice(0, 4000)}

Write a clear, concise response in the same language as the user's message (French if they wrote in French, English otherwise). Present the key information naturally. No JSON, no markdown code blocks. Be direct and useful.`;
}

/**
 * Tente de traiter un message comme une lecture simple mono-tool via K2.5.
 * Retourne {text, slug} si succès, null sinon (fail-soft total).
 *
 * @param params.message       - Le message utilisateur
 * @param params.entityId      - L'identifiant Composio de l'utilisateur
 * @param params.conversationId - Optionnel, non utilisé ici (transmis pour cohérence)
 */
export async function tryLiteAgent(params: {
  message: string;
  entityId: string;
  conversationId?: string;
}): Promise<LiteAgentResult | null> {
  const { message, entityId } = params;

  try {
    // ── Étape 0 : récupérer les apps actives de l'user ─────────────────────
    const connections = await listConnections(entityId);
    const activeSlugs = Array.from(
      new Set(
        connections
          .filter((c) => c.status === "ACTIVE")
          .map((c) => c.appName.toLowerCase())
          .filter(Boolean),
      ),
    );

    if (activeSlugs.length === 0) {
      logger.debug({ entityId }, "[lite-agent] no ACTIVE connections — skip");
      return null;
    }

    // ── Étape 1 : construire la liste compacte et appeler K2.5 (classify) ──
    const { lines: compactList, allReadSlugs } = buildReadActionsCompact(activeSlugs);

    if (allReadSlugs.size === 0) {
      // Aucune app active n'est dans ESSENTIAL_READS — pas de read-actions connues.
      logger.debug({ entityId, activeSlugs }, "[lite-agent] no known read actions — skip");
      return null;
    }

    const classifyPrompt = buildClassifyPrompt(message, compactList);

    // Résoudre dynamiquement le provider/model : Kimi si KIMI_API_KEY présent, sinon OpenAI cheap.
    const liteAgentCfg = resolveConversationalFastpathConfig();

    // Race timeout ~3.5s pour ne pas pénaliser le TTFT si K2.5 est lent.
    const CLASSIFY_TIMEOUT_MS = 3500;

    type ClassifyResult =
      | { slug: string; args: Record<string, unknown> }
      | { fallback: true }
      | null;

    const classifyRace = Promise.race<ClassifyResult>([
      chatWithCircuitBreaker<ClassifyResult>({
        tenantId: entityId, // reuse entityId as tenantId for breaker isolation
        provider: liteAgentCfg.provider,
        context: "lite-agent/classify",
        chatRequest: {
          model: liteAgentCfg.model,
          max_tokens: 256,
          temperature: 0,
          messages: [{ role: "user", content: classifyPrompt }],
        },
        fallback: null,
        parse: (res) => {
          let txt = res.content ?? "";
          // Strip <think>…</think> reasoning blocks (Kimi quirk)
          txt = txt.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
          // Extract first JSON object
          const match = txt.match(/\{[\s\S]*\}/);
          if (!match) {
            logger.debug({ raw: txt.slice(0, 80) }, "[lite-agent] classify: no JSON found");
            return null;
          }
          try {
            return JSON.parse(match[0]) as ClassifyResult;
          } catch {
            logger.debug({ raw: match[0].slice(0, 80) }, "[lite-agent] classify: JSON parse error");
            return null;
          }
        },
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), CLASSIFY_TIMEOUT_MS)),
    ]);

    const classify = await classifyRace;

    // ── Valider le résultat classify ───────────────────────────────────────
    if (!classify) {
      logger.debug("[lite-agent] classify returned null — fallback");
      return null;
    }
    if ("fallback" in classify && classify.fallback === true) {
      logger.debug("[lite-agent] classify: fallback=true — fall-through");
      return null;
    }
    if (!("slug" in classify) || typeof classify.slug !== "string" || !classify.slug) {
      logger.debug({ classify }, "[lite-agent] classify: invalid shape — fallback");
      return null;
    }

    const resolvedSlug = classify.slug.toUpperCase();
    const resolvedArgs = (classify.args as Record<string, unknown>) ?? {};

    // ── Write-guard : jamais d'écriture en lite-agent ──────────────────────
    if (isWriteSlug(resolvedSlug)) {
      logger.debug({ slug: resolvedSlug }, "[lite-agent] write slug detected — fallback");
      return null;
    }

    // ── Vérifier que le slug fait partie des reads connus ──────────────────
    if (!allReadSlugs.has(resolvedSlug)) {
      logger.debug(
        { slug: resolvedSlug },
        "[lite-agent] slug not in known read actions — fallback",
      );
      return null;
    }

    // ── Étape 2 : exécuter l'action Composio ──────────────────────────────
    logger.info(
      { slug: resolvedSlug, entityId, args: resolvedArgs },
      "[lite-agent] executing action",
    );

    const execResult = await executeComposioAction({
      action: resolvedSlug,
      entityId,
      params: resolvedArgs,
    });

    if (!execResult.ok) {
      logger.debug(
        { slug: resolvedSlug, error: execResult.error },
        "[lite-agent] execute failed — fallback",
      );
      return null;
    }

    // ── Étape 3 : résumer le résultat en prose via K2.5 ───────────────────
    const rawResult =
      typeof execResult.data === "string"
        ? execResult.data
        : JSON.stringify(execResult.data, null, 2);

    const summarizePrompt = buildSummarizePrompt(message, rawResult);

    const SUMMARIZE_TIMEOUT_MS = 5000;

    type SummarizeResult = string | null;

    const summarizeRace = Promise.race<SummarizeResult>([
      chatWithCircuitBreaker<SummarizeResult>({
        tenantId: entityId,
        provider: liteAgentCfg.provider,
        context: "lite-agent/summarize",
        chatRequest: {
          model: liteAgentCfg.model,
          max_tokens: 1024,
          temperature: 0.3,
          messages: [{ role: "user", content: summarizePrompt }],
        },
        fallback: null,
        parse: (res) => {
          let txt = res.content ?? "";
          txt = txt.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
          return txt.length > 0 ? txt : null;
        },
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), SUMMARIZE_TIMEOUT_MS)),
    ]);

    const summary = await summarizeRace;

    if (!summary) {
      logger.debug("[lite-agent] summarize returned null — fallback");
      return null;
    }

    logger.info(
      { slug: resolvedSlug, entityId, summaryLength: summary.length },
      "[lite-agent] success",
    );

    return { text: summary, slug: resolvedSlug };
  } catch (err) {
    // Fail-soft TOTAL — jamais de throw vers le pipeline
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "[lite-agent] unexpected error — fallback",
    );
    return null;
  }
}
