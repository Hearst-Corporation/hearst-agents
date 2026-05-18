import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import type { Json } from "@/lib/database.types";
import type { ModelGoal } from "@/lib/decisions/model-selector";
import { chatRequestSchema, err, parseBody } from "@/lib/domain";
import { RunTracer } from "@/lib/engine/runtime";
import type { AgentGuardPolicy } from "@/lib/engine/runtime/prompt-guard";
import type { ChatMessage, ModelDecision } from "@/lib/llm";
import { getProvider, smartStreamChat } from "@/lib/llm";
import { redactedError, withRoute } from "@/lib/observability/logger";
import { requireScope } from "@/lib/platform/auth/scope";
import { requireServerSupabase } from "@/lib/platform/db/supabase";
import { getRedis, redisSetNxEx } from "@/lib/platform/redis/client";

/**
 * Anti-double-submit (P0-1) — le chat est GRATUIT : AUCUN débit crédit ici.
 * Garde purement idempotente : un retry réseau (double POST) sur la même
 * conversation + même message déclencherait sinon 2 runs LLM + 2 messages
 * user → historique corrompu.
 *
 * Lock court Redis `SET NX EX` (~120s) sur une clé déterministe. Si Redis
 * est indisponible → fail-OPEN (on log un warn, on ne bloque pas le chat).
 */
const CHAT_LOCK_TTL_SECONDS = 120;

function chatIdempotencyKey(conversationId: string, userMessageContent: string): string {
  return createHash("sha256").update(`${conversationId}:${userMessageContent}`).digest("hex");
}

const log = withRoute("POST /api/agents/[id]/chat");

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Traduit une erreur interne en code générique sûr pour le client.
 * Évite de fuiter des messages de provider (quota, clé invalide, body LLM, etc.)
 */
function sanitizeClientError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (lower.includes("timeout") || lower.includes("aborted") || lower.includes("abort")) {
    return "timeout";
  }
  if (lower.includes("cost") || lower.includes("budget") || lower.includes("quota")) {
    return "cost_limit";
  }
  if (lower.includes("rate limit") || lower.includes("ratelimit") || lower.includes("429")) {
    return "provider_error";
  }
  if (
    lower.includes("api key") ||
    lower.includes("unauthorized") ||
    lower.includes("forbidden") ||
    lower.includes("401") ||
    lower.includes("403")
  ) {
    return "provider_error";
  }
  return "server_error";
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Auth gate : exécute des appels LLM côté agent — public = abus tokens.
  const { scope, error: scopeError } = await requireScope({
    context: `POST /api/agents/${id}/chat`,
  });
  if (scopeError || !scope) {
    return err(scopeError?.message ?? "not_authenticated", scopeError?.status ?? 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err("Invalid JSON body", 400);
  }

  const parsed = parseBody(chatRequestSchema, body);
  if (!parsed.success) return parsed.response;

  const sb = requireServerSupabase();
  const userMessage = parsed.data.message;
  let conversationId = parsed.data.conversation_id ?? null;

  // Filtre tenant_id — empêche le chat cross-tenant IDOR (F-002)
  const { data: agent, error: agentErr } = await sb
    .from("agents")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", scope.tenantId)
    .single();

  if (agentErr || !agent) return err("not_found", 404);

  if (!conversationId) {
    const { data: convo } = await sb
      .from("conversations")
      .insert({ agent_id: id, title: userMessage.slice(0, 80) })
      .select("id")
      .single();
    conversationId = convo?.id ?? null;
  }

  if (!conversationId) return err("failed_to_create_conversation", 500);

  // P0-1 — lock idempotent anti-double-submit. Posé APRÈS résolution de
  // conversationId (clé déterministe = conversation + message) et AVANT
  // l'insert du message user / le run LLM. Fail-OPEN si Redis absent.
  const idempotencyKey = chatIdempotencyKey(conversationId, userMessage);
  const lockKey = `chat:lock:${idempotencyKey}`;
  const redis = getRedis();
  let lockAcquired = false;
  if (redis) {
    try {
      lockAcquired = await redisSetNxEx(redis, lockKey, "1", CHAT_LOCK_TTL_SECONDS);
      if (!lockAcquired) {
        // Un run identique est déjà en vol (double POST / retry réseau).
        return err("run_already_in_flight", 409);
      }
    } catch (lockErr) {
      // Fail-open : ne jamais casser le chat à cause de la couche lock.
      log.warn({ err: redactedError(lockErr), agentId: id }, "chat_idempotency_lock_unavailable");
    }
  } else {
    log.warn({ agentId: id }, "chat_idempotency_lock_no_redis");
  }

  // Libère le lock une seule fois (best-effort) — appelé sur chaque chemin
  // terminal du run (succès, erreur stream). No-op si Redis absent ou si le
  // lock n'a pas été acquis par cette requête.
  let lockReleased = false;
  const releaseLock = async (): Promise<void> => {
    if (lockReleased || !redis || !lockAcquired) return;
    lockReleased = true;
    try {
      await redis.del(lockKey);
    } catch (delErr) {
      log.warn({ err: redactedError(delErr), agentId: id }, "chat_idempotency_lock_release_failed");
    }
  };

  // P1-A — tout le travail entre l'acquisition du lock et le RETOUR du
  // ReadableStream (insert message user, Promise.all, build prompt,
  // tracer.startRun/trace) s'exécute hors du try/finally interne au stream.
  // Si une de ces lignes throw, le POST throw AVANT que le ReadableStream
  // existe → le finally interne n'est jamais atteint → le lock survit 120s →
  // le retry LÉGITIME du user (même message) se prend un 409
  // run_already_in_flight pendant 2 min, pile au moment où il réessaie.
  //
  // On enrobe donc cette section dans un try/catch qui libère le lock avant
  // de rethrow. releaseLock est idempotent (flag lockReleased) → aucun
  // double-release cassant avec le finally interne au stream sur le chemin
  // nominal.
  try {
    await sb.from("messages").insert({
      conversation_id: conversationId,
      role: "user",
      content: userMessage,
    });

    const [historyRes, skillsRes, memoriesRes] = await Promise.all([
      sb
        .from("messages")
        .select("role, content")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(50),
      sb
        .from("agent_skills")
        .select("skill_id, priority, config, skills(name, prompt_template)")
        .eq("agent_id", id)
        .order("priority", { ascending: false }),
      sb
        .from("agent_memory")
        .select("key, value")
        .eq("agent_id", id)
        .order("importance", { ascending: false })
        .limit(20),
    ]);

    const skillsBlock = (skillsRes.data ?? [])
      .map((s) => {
        const skill = s.skills as unknown as { name: string; prompt_template: string } | null;
        return skill ? `[SKILL: ${skill.name}]\n${skill.prompt_template}` : "";
      })
      .filter(Boolean)
      .join("\n\n");

    const memoryBlock = (memoriesRes.data ?? []).map((m) => `- ${m.key}: ${m.value}`).join("\n");

    const systemPrompt = [
      agent.system_prompt,
      skillsBlock ? `\n\n## Skills\n${skillsBlock}` : "",
      memoryBlock ? `\n\n## Memory\n${memoryBlock}` : "",
    ].join("");

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...((historyRes.data ?? []) as ChatMessage[]),
    ];

    const guardPolicy = (agent.guard_policy as AgentGuardPolicy | null) ?? undefined;

    const tracer = new RunTracer(sb, scope.tenantId);
    const runId = await tracer.startRun({
      kind: "chat",
      agent_id: id,
      conversation_id: conversationId,
      input: { message: userMessage },
      cost_budget_usd: agent.cost_budget_per_run ?? undefined,
      guard_policy: guardPolicy,
    });

    if (memoriesRes.data && memoriesRes.data.length > 0) {
      await tracer.trace({
        kind: "memory_read",
        name: "load_agent_memory",
        input: { agent_id: id, count: memoriesRes.data.length },
        fn: async () => ({
          output: { memories: memoriesRes.data?.length },
        }),
      });
    }

    const useSmartRouting = parsed.data.smart_routing === true;
    const modelGoal: ModelGoal = parsed.data.model_goal ?? "balanced";

    const encoder = new TextEncoder();
    const llmStart = Date.now();

    const readable = new ReadableStream({
      async start(controller) {
        let fullContent = "";
        let modelDecision: ModelDecision | undefined;
        let actualModelUsed = `${agent.model_provider}/${agent.model_name}`;
        let finalCostUsd = 0;
        let finalTokensIn = 0;
        let finalTokensOut = 0;

        try {
          try {
            if (useSmartRouting) {
              const smartStream = smartStreamChat(sb, {
                goal: modelGoal,
                agent_provider: agent.model_provider,
                agent_model: agent.model_name,
                messages,
                temperature: agent.temperature,
                max_tokens: agent.max_tokens,
                top_p: agent.top_p,
                tracer,
                userId: scope.userId,
                tenantId: scope.tenantId,
              });

              for await (const chunk of smartStream) {
                if (chunk.decision) modelDecision = chunk.decision;
                if (chunk.profile_used) actualModelUsed = chunk.profile_used;
                fullContent += chunk.delta;
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ delta: chunk.delta, done: chunk.done, run_id: runId })}\n\n`,
                  ),
                );
                if (chunk.done) {
                  finalCostUsd = chunk.cost_usd ?? 0;
                  finalTokensIn = chunk.tokens_in ?? 0;
                  finalTokensOut = chunk.tokens_out ?? 0;
                  break;
                }
              }
            } else {
              const provider = getProvider(agent.model_provider);
              const stream = provider.streamChat({
                model: agent.model_name,
                messages,
                temperature: agent.temperature,
                max_tokens: agent.max_tokens,
                top_p: agent.top_p,
                stream: true,
              });

              for await (const chunk of stream) {
                fullContent += chunk.delta;
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ delta: chunk.delta, done: chunk.done, run_id: runId })}\n\n`,
                  ),
                );
                if (chunk.done) {
                  finalCostUsd = chunk.cost_usd ?? 0;
                  finalTokensIn = chunk.tokens_in ?? 0;
                  finalTokensOut = chunk.tokens_out ?? 0;
                  break;
                }
              }
            }
          } catch (streamErr) {
            const rawMsg = streamErr instanceof Error ? streamErr.message : "stream_failed";
            const clientError = sanitizeClientError(streamErr);
            log.error({ err: redactedError(streamErr), agentId: id, runId }, "chat_stream_failed");
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ error: clientError, done: true, run_id: runId })}\n\n`,
              ),
            );
            await tracer.endRun("failed", {}, rawMsg);
            controller.close();
            return;
          }

          const llmLatency = Date.now() - llmStart;

          await sb.from("messages").insert({
            conversation_id: conversationId,
            role: "assistant",
            content: fullContent,
            model_used: actualModelUsed,
            latency_ms: llmLatency,
          });

          const traceResult = await tracer.trace({
            kind: "llm_call",
            name: actualModelUsed,
            input: {
              messages_count: messages.length,
              system_prompt_length: systemPrompt.length,
              smart_routing: useSmartRouting,
              model_goal: useSmartRouting ? modelGoal : undefined,
              was_overridden: modelDecision?.was_overridden ?? false,
            },
            fn: async () => ({
              output: { content: fullContent, content_length: fullContent.length } as Record<
                string,
                Json
              >,
              tokens_in: finalTokensIn,
              tokens_out: finalTokensOut,
              cost_usd: finalCostUsd,
              model_used: actualModelUsed,
            }),
          });

          const validation = traceResult.validation;

          await tracer.endRun("completed", {
            content_length: fullContent.length,
            conversation_id: conversationId,
            output_trust: validation?.trust ?? "unverified",
            output_classification: validation?.classification ?? "valid",
            output_score: validation?.score ?? 1,
            smart_routing: useSmartRouting,
            model_decision: modelDecision
              ? {
                  selected: `${modelDecision.selected_provider}/${modelDecision.selected_model}`,
                  was_overridden: modelDecision.was_overridden,
                  reason: modelDecision.reason,
                  goal: modelDecision.goal,
                }
              : undefined,
          });

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                done: true,
                run_id: runId,
                model_used: actualModelUsed,
                validation: validation
                  ? {
                      trust: validation.trust,
                      classification: validation.classification,
                      score: validation.score,
                    }
                  : undefined,
                model_decision: modelDecision
                  ? {
                      selected: `${modelDecision.selected_provider}/${modelDecision.selected_model}`,
                      was_overridden: modelDecision.was_overridden,
                      reason: modelDecision.reason,
                      goal: modelDecision.goal,
                      fallback_count: modelDecision.fallback_count,
                    }
                  : undefined,
              })}\n\n`,
            ),
          );

          controller.close();
        } finally {
          // P0-1 — libère le lock idempotent quel que soit le chemin terminal
          // (succès, erreur stream avec return anticipé, throw inattendu).
          await releaseLock();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Conversation-Id": conversationId,
        "X-Run-Id": runId,
      },
    });
  } catch (preStreamErr) {
    // P1-A — throw AVANT que le ReadableStream soit retourné (insert message
    // user, Promise.all, build prompt, tracer.startRun/trace, construction du
    // stream). Le finally interne au stream n'a jamais pu s'exécuter → on
    // libère ici le lock pour ne pas bloquer le retry user pendant 120s, puis
    // on rethrow pour conserver le comportement d'erreur d'origine.
    await releaseLock();
    throw preStreamErr;
  }
}
