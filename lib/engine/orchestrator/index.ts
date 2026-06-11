/**
 * Orchestrator — Public façade.
 *
 * Entry point for the v2 pipeline:
 * 1. Resolve CapabilityScope → ExecutionMode (capability-first router)
 * 2. Create RunEngine
 * 3. Dispatch to the appropriate handler based on mode
 * 4. Stream results via SSE
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { isFeatureEnabled } from "@/lib/admin/settings";
import { selectAgentForContext } from "@/lib/agents/agent-selector";
import {
  resolveCapabilities,
  resolveCapabilityContextId,
  shouldSkipCortexResolve,
} from "@/lib/capabilities/cortex-resolver";
import { classifyDomainLLM } from "@/lib/capabilities/domain-classifier";
import {
  type ExecutionDecision,
  isBusinessSurface,
  resolveCapabilityScope,
  resolveExecutionMode,
  scopeForDomain,
  scopeRequiresProviders,
} from "@/lib/capabilities/router";
import { preflightConnector } from "@/lib/connectors/control-plane/preflight";
import { RunEngine } from "@/lib/engine/runtime/engine";
import type { CreateRunInput } from "@/lib/engine/runtime/engine/types";
import { addRun as storeRun } from "@/lib/engine/runtime/runs/store";
import type { RunRecord } from "@/lib/engine/runtime/runs/types";
import {
  saveRun as persistRun,
  updateRun as persistUpdateRun,
} from "@/lib/engine/runtime/state/adapter";
import { persistRunEvent, shouldPersistEvent } from "@/lib/engine/runtime/timeline/persist";
import { RunEventBus } from "@/lib/events/bus";
import { LogPersister } from "@/lib/events/consumers/log-persister";
import { SSEAdapter } from "@/lib/events/consumers/sse-adapter";
import { globalRunBus } from "@/lib/events/global-bus";
import { appendToSummary } from "@/lib/memory/conversation-summary";
import { memoryToConversationHistory } from "@/lib/memory/format";
import { appendMessage, getRecentMessages } from "@/lib/memory/store";
import { assertTenantScope } from "@/lib/multi-tenant/guards";
import type { TenantScope } from "@/lib/multi-tenant/types";
import { logger } from "@/lib/observability/logger";
import { SYSTEM_CONFIG } from "@/lib/system/config";
import { registerRun, unregisterRun } from "./abort-registry";
import { runAiPipeline } from "./ai-pipeline";
import { detectFastPathAction } from "./composio-fastpath";
import { isPureConversational, runConversationalFastpath } from "./conversational-fastpath";
import { classifyExecutionTier, type ExecutionTier, gateToolsByTier } from "./execution-tier";
import {
  getBlockedReasonForProviders,
  getRequiredProvidersForInput,
} from "./provider-requirements";
import { isReportIntent, isResearchIntent, shouldBypassResearchPath } from "./research-intent";
import { isComplexIntent, isPlannerEnabled, runPlannerWorkflow } from "./run-planner-workflow";
import { runResearchReport } from "./run-research-report";
import { checkSafetyGate } from "./safety-gate";
import { isScheduleIntent } from "./schedule-intent";

interface FocalContext {
  id: string;
  objectType: string;
  title: string;
  status: string;
}

interface OrchestrateInput {
  userId: string;
  message: string;
  conversationId?: string;
  threadId?: string;
  surface?: string;
  focalContext?: FocalContext;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  /** B4 — assets droppés dans ChatInput. Le pipeline IA les injecte dans le user message. */
  attachedAssetIds?: string[];
  /** C4 — persona explicite (override per-thread / par message). */
  personaId?: string;
  /** Set when triggered by the scheduler for a scheduled mission. */
  missionId?: string;
  /**
   * Mission Memory (vague 9) — bloc XML <mission_context>…</mission_context>
   * pré-formaté à injecter dans le system prompt cacheable. Contient le
   * `contextSummary` mission + N derniers `mission_messages`. Calculé en
   * amont (route /missions/[id]/run) via `formatMissionContextBlock` pour
   * éviter de coupler l'orchestrator à Supabase.
   */
  missionContext?: string;
  tenantId?: string;
  workspaceId?: string;
  /**
   * Impersonation Hive — entity Composio à utiliser pour la discovery/exécution
   * des tools. Présent uniquement sous Bearer hsk_* `impersonate` (`hive:<tenant>`).
   * Absent pour les users Helm natifs → le pipeline retombe sur userId.
   */
  composioEntityId?: string;
  /** Price cap (USD) pour ce run — rejette si dépassé */
  max_cost_usd?: number;
  /** Injected by runPipeline — resolved capability domain */
  _capabilityDomain?: string;
  /** Injected by runPipeline — tools allowed for the current capability scope */
  _allowedTools?: string[];
  /**
   * Injected by runPipeline — source de la policy tools.
   * - "legacy" : taxonomie locale (hardcoded)
   * - "cortex" : résolution dynamique Context/Cortex
   */
  _allowedToolsSource?: "legacy" | "cortex";
  /** Injected by runPipeline — recurring intent detected, force schedule preview. */
  _scheduleDirective?: boolean;
  /** Prénom / nom de l'utilisateur connecté (depuis scope.userName). Fail-soft si absent. */
  userName?: string;
}

const DEV_TENANT_ID = "dev-tenant";
const DEV_WORKSPACE_ID = "dev-workspace";

function shortId(id?: string): string | undefined {
  return id ? id.slice(0, 8) : undefined;
}

function buildTenantScope(input: OrchestrateInput): TenantScope {
  if (!input.tenantId || !input.workspaceId) {
    if (SYSTEM_CONFIG.requireTenantScopeForV2) {
      throw new Error(
        `[orchestrate] tenantId ou workspaceId manquant (tenantId=${input.tenantId}, workspaceId=${input.workspaceId}). ` +
          "Vérifier que requireScope() est appelé en amont et que la session utilisateur est valide.",
      );
    }
    console.warn("[Orchestrator] tenantId/workspaceId absents — fallback dev actif");
  }

  const scope: TenantScope = {
    tenantId: input.tenantId ?? DEV_TENANT_ID,
    workspaceId: input.workspaceId ?? DEV_WORKSPACE_ID,
    userId: input.userId,
  };

  assertTenantScope(scope);
  return scope;
}

/**
 * Full orchestration pipeline returning an SSE ReadableStream.
 */
export function orchestrate(db: SupabaseClient, input: OrchestrateInput): ReadableStream {
  const eventBus = new RunEventBus();
  eventBus.on((e) => globalRunBus.broadcast(e));
  // missionId résolu en amont (scheduler / route /missions/[id]/run). Permet
  // au SSEAdapter de stamper `mission_id` sur les events HITL (approval /
  // clarification) que Hive consomme. Fail-open : undefined pour un chat libre.
  const sse = new SSEAdapter(eventBus, input.missionId);
  const logPersister = new LogPersister(db);
  const cleanupLogs = logPersister.attach(eventBus);

  const stream = new ReadableStream({
    start(controller) {
      sse.pipe(controller);
      // Keep-alive : envoie un commentaire SSE toutes les 20s pour que les
      // proxies (Cloudflare, Vercel, nginx) ne ferment pas la connexion sur
      // les runs longs (research, browser, video gen, meeting bot).
      sse.startHeartbeat(20_000);

      // ── Signal d'accusé immédiat (perf TTFT perçu) ────────────────────────
      // `runPipeline` fait du travail async avant le 1er event utile (WAL Redis,
      // getRecentMessages, resolveCapabilities, RunEngine.create…) : ~2-3 s sur
      // un cold start. Sans signal précoce, le client reste muet pendant ce
      // temps. On émet donc un `orchestrator_log` SYNCHRONE dès l'ouverture du
      // flux — il part en <50 ms après le TTFB réseau, AVANT tout I/O — pour que
      // l'UI affiche un indicateur "réfléchit…" instantanément. Le `run_started`
      // (avec run_id réel) suit dès que RunEngine est créé. Type déjà géré par
      // l'adaptateur SSE → no-op visuel si le client ne l'affiche pas.
      // run_id="" : placeholder — le RunEngine (et donc l'id réel) n'existe pas
      // encore. L'adaptateur SSE de orchestrator_log ne lit que `message`.
      eventBus.emit({ type: "orchestrator_log", run_id: "", message: "request_accepted" });

      runPipeline(db, eventBus, sse, input)
        .catch((err) => {
          console.error("[Orchestrator] pipeline error:", err);
          sse.sendError(err);
        })
        .finally(() => {
          cleanupLogs();
          sse.close();
          eventBus.destroy();
        });
    },
  });

  return stream;
}

// ── Mode handler ─────────────────────────────────────────────
//
// Every execution mode (direct_answer, tool_call, workflow, custom_agent,
// managed_agent) flows through the same AI pipeline. Reading user data
// (Gmail, Calendar, Drive, Slack, Notion…) is the model's job: it calls the
// relevant Composio tool when it actually needs the data. There is no
// orchestrator-level pre-fetch.

async function handleAiPipeline(
  engine: RunEngine,
  eventBus: RunEventBus,
  input: OrchestrateInput,
  scope: TenantScope,
  abortSignal?: AbortSignal,
  executionMode?: string,
  executionTier?: ExecutionTier,
): Promise<void> {
  eventBus.emit({
    type: "orchestrator_log",
    run_id: engine.id,
    message: "AI pipeline: agentic execution…",
  });

  await runAiPipeline(engine, eventBus, {
    userId: input.userId,
    message: input.message,
    conversationHistory: input.conversationHistory,
    surface: input.surface,
    domain: input._capabilityDomain,
    scheduleDirective: input._scheduleDirective ?? false,
    tenantId: scope.tenantId,
    workspaceId: scope.workspaceId,
    conversationId: input.conversationId,
    threadId: input.threadId,
    attachedAssetIds: input.attachedAssetIds,
    personaId: input.personaId,
    missionContext: input.missionContext,
    abortSignal,
    // PERF (2026-06-04) : mode d'exécution → en direct_answer, ai-pipeline saute
    // la discovery Composio + l'injection des schémas de tools dans le prompt.
    executionMode,
    // Tier d'exécution (zéro LLM) → routing modèle fast/strong + skip Composio memory.
    executionTier,
    // F-011 : passer les tools autorisés pour l'agent scope courant
    _allowedTools: input._allowedTools,
    _allowedToolsSource: input._allowedToolsSource,
    // F-012 : passer missionId pour déclencher l'isolation scheduler
    missionId: input.missionId,
    // Profil utilisateur pour personnalisation du system prompt
    userName: input.userName,
    // Impersonation Hive : entity Composio (hive:<tenant>) si présent, sinon undefined
    composioEntityId: input.composioEntityId,
  });
}

// ── Main pipeline ────────────────────────────────────────────
//
// Mission scheduling is handled by the `create_scheduled_mission` tool in the
// AI pipeline (preview + confirm). Schedule intent is detected pre-LLM in
// `runPipeline` so the prompt receives a forcing directive at build time.

async function runPipeline(
  db: SupabaseClient,
  eventBus: RunEventBus,
  _sse: SSEAdapter,
  input: OrchestrateInput,
): Promise<void> {
  const pipelineStartedAt = Date.now();
  const scope = buildTenantScope(input);

  // ── Memory: resolve conversationId from threadId if absent ──
  if (!input.conversationId && input.threadId) {
    input.conversationId = input.threadId;
  }

  // ── Memory: load conversation context ──────────────────────
  if (input.conversationId) {
    // Await la WAL durable côté store : garantit que le message user est
    // récupérable depuis Redis même si le process meurt avant le persist
    // Supabase. Coût ~5ms — négligeable face au LLM call qui suit.
    await appendMessage(
      input.conversationId,
      {
        role: "user",
        content: input.message,
        createdAt: Date.now(),
      },
      scope,
    );
    void appendToSummary({ userId: input.userId, role: "user", content: input.message });

    if (!input.conversationHistory || input.conversationHistory.length === 0) {
      // Passe le scope pour filtrer par user_id — empêche la lecture cross-user (F-003)
      const recentMemory = await getRecentMessages(input.conversationId, 10, scope);
      // Exclude the message we just appended (last one)
      const prior = recentMemory.slice(0, -1);
      if (prior.length > 0) {
        input.conversationHistory = memoryToConversationHistory(prior);
      }
    }
  }

  // ── Pre-LLM signal injection ──────────────────────────────
  // Schedule intent is detected here so `buildAgentSystemPrompt` can
  // prepend a forcing directive — without it the model treats a recurring
  // request ("tous les matins à 8h") as a one-shot.
  const scheduleDetected = isScheduleIntent(input.message);
  input._scheduleDirective = scheduleDetected;

  // ── 1. Capability-first routing ─────────────────────────────
  // Chemin rapide : scoring mots-clés (O(1), 0 IA).
  let capScope = resolveCapabilityScope(input.message, input.surface);

  // Routing COGNITIF — fire-and-forget hors chemin critique (P5 perf).
  // On lance le classifieur LLM en parallèle SANS l'awaiter : si le résultat
  // arrive avant que le pipeline IA n'ait besoin du domain, on l'applique ;
  // sinon le pipeline part avec le scope mots-clés (fail-soft, déjà correct
  // dans 80% des cas). Évite +500ms-2s de TTFT sur cold start LRU.
  // Seule une surface MÉTIER connue (inbox/calendar/files/finance/research)
  // est "dédiée" → on lui fait confiance et on n'affine pas par LLM. Une
  // surface conteneur comme "hive" (ou "home"/inconnue) NE l'est pas : on
  // laisse le classifieur LLM affiner "general" → vrai domaine. Même set que
  // resolveCapabilityScope (réutilisé depuis router.ts, pas de duplication).
  const hasDedicatedSurface = isBusinessSurface(input.surface);
  const classifierPromise: Promise<void> =
    !hasDedicatedSurface && capScope.domain === "general" && input.message.trim().length > 12
      ? classifyDomainLLM(input.message, { tenantId: scope.tenantId, fallback: "general" })
          .then((refined) => {
            if (refined !== "general") {
              logger.info(
                { from: "general", to: refined },
                "[Router] domaine affiné par classifieur LLM (async)",
              );
              capScope = { ...capScope, ...scopeForDomain(refined) };
            }
          })
          .catch(() => {
            /* fail-soft */
          })
      : Promise.resolve();
  // Attente courte : on donne 200ms au classifieur pour répondre depuis le
  // cache LRU chaud (Redis hit ~5ms). Au-delà on continue sans lui.
  await Promise.race([classifierPromise, new Promise<void>((r) => setTimeout(r, 200))]);

  const decision: ExecutionDecision = resolveExecutionMode(
    capScope,
    input.message,
    input.focalContext,
  );
  const routingResolvedMs = Date.now() - pipelineStartedAt;

  // shouldBypassResearchPath : une requête mémoire/vault ("cherche dans mes
  // notes", "qu'avons-nous décidé sur X") matche isResearchIntent ("cherche")
  // mais doit rester sur le chemin streamText+tools (cortex_search), PAS le
  // research path web-only. Le bypass existait déjà mais n'était pas consulté
  // ici → les recherches vault partaient en workflow web et n'appelaient jamais
  // cortex_search.
  const researchDetected =
    isResearchIntent(input.message) && !shouldBypassResearchPath(input.message);
  const reportDetected = isReportIntent(input.message);

  if (researchDetected && decision.mode === "direct_answer") {
    decision.mode = "workflow";
    decision.reason = "Research intent detected — promoted from DIRECT_ANSWER";
    decision.backend = "hearst_runtime";
    logger.info("[ExecutionMode] Research override: direct_answer → workflow");
  }

  input._capabilityDomain = capScope.domain;
  input._allowedTools = capScope.allowedTools;
  input._allowedToolsSource = "legacy";

  // ── Cortex capabilities resolution (Context -> allowed tools) ─────────────
  // Remplace/complète la liste hardcodée locale si Cortex répond.
  // Fallback contrôlé :
  // - status=ok/empty/error -> mode "cortex" (empty possible)
  // - status=skipped        -> mode strict sans tools, sauf override explicite
  //   HELM_CAPABILITIES_LEGACY_FALLBACK=1 (debug local uniquement)
  const contextId = resolveCapabilityContextId({
    composioEntityId: input.composioEntityId,
    tenantId: scope.tenantId,
  });
  // ── Court-circuit perf (zéro round-trip Cortex quand inutile) ─────────────
  // - conversationnel (mode direct_answer) : aucun tool requis.
  // - contexte full-grant (env HELM_CORTEX_FULL_GRANT_CONTEXTS) : a déjà tout
  //   → on garde le toolset natif Helm intent-scopé (capScope.allowedTools).
  // Sinon : résolution Cortex (sécurité multi-contexte), désormais CACHÉE 60s.
  const skipDecision = shouldSkipCortexResolve(decision.mode, contextId);
  if (skipDecision.skip) {
    logger.info(
      {
        reason: skipDecision.reason,
        mode: decision.mode,
        allowedToolsCount: input._allowedTools?.length ?? 0,
      },
      "[Orchestrator] Cortex resolve court-circuité — toolset natif intent-scopé",
    );
  } else {
    const cortexCapabilities = await resolveCapabilities({
      tenantId: scope.tenantId,
      contextId,
      userId: input.userId,
    });

    if (cortexCapabilities.status !== "skipped") {
      input._allowedTools = cortexCapabilities.tools;
      input._allowedToolsSource = "cortex";

      logger.info(
        {
          status: cortexCapabilities.status,
          httpStatus: cortexCapabilities.httpStatus,
          reason: cortexCapabilities.reason,
          toolsCount: cortexCapabilities.tools.length,
        },
        "[Orchestrator] Allowed tools resolved via Cortex",
      );
    } else {
      const allowLegacyFallback = process.env.HELM_CAPABILITIES_LEGACY_FALLBACK === "1";
      if (allowLegacyFallback) {
        logger.warn(
          { reason: cortexCapabilities.reason },
          "[Orchestrator] Cortex resolver skipped — legacy fallback enabled",
        );
      } else {
        input._allowedTools = [];
        input._allowedToolsSource = "cortex";
        logger.warn(
          { reason: cortexCapabilities.reason },
          "[Orchestrator] Cortex resolver skipped — strict mode (no tools exposed)",
        );
      }
    }
  }
  const capabilitiesResolvedMs = Date.now() - pipelineStartedAt;

  // ── Execution tier : borne les tools coûteux AVANT le LLM ──────────────
  // Consolide les signaux (action machine / intent complexe / recherche /
  // recall) en un tier pur, zéro LLM. kickoff_swarm (swarm hive 4-8 min) n'est
  // proposé au modèle que sur le tier "swarm" → anti-sur-déclenchement coûteux.
  // Le tier GUIDE (borne le toolset), le LLM décide ; fail-soft → "direct".
  const { tier: executionTier, reason: tierReason } = classifyExecutionTier(input.message);
  input._allowedTools = gateToolsByTier(input._allowedTools, executionTier);

  logger.info(
    {
      mode: decision.mode,
      reason: decision.reason,
      domain: capScope.domain,
      tier: executionTier,
      tierReason,
      scheduleDetected,
      allowedToolsSource: input._allowedToolsSource ?? "legacy",
      allowedToolsCount: input._allowedTools?.length ?? 0,
    },
    "[ExecutionMode] resolved",
  );
  console.info("[Orchestrator] latency_route", {
    user_id: shortId(input.userId),
    tenant_id: shortId(scope.tenantId),
    mode: decision.mode,
    domain: capScope.domain,
    tier: executionTier,
    routing_ms: routingResolvedMs,
    capabilities_ms: capabilitiesResolvedMs,
    allowed_tools_count: input._allowedTools?.length ?? 0,
  });

  // ── 2. Create Run ──────────────────────────────────────────
  const createInput: CreateRunInput = {
    user_id: input.userId,
    tenant_id: scope.tenantId,
    conversation_id: input.conversationId ?? null,
    entrypoint: input.missionId ? "webhook" : "chat",
    request: {
      message: input.message,
      surface: input.surface,
      context: {
        execution_mode: decision.mode,
        tool_context: capScope.toolContext,
        ...(decision.agentId ? { agent_id: decision.agentId } : {}),
        ...(decision.backend ? { agent_backend: decision.backend } : {}),
        ...(input.missionId ? { mission_id: input.missionId } : {}),
        ...(input.focalContext ? { focal_context: input.focalContext } : {}),
      },
    },
  };

  // P3 perf : RunEngine.create (Supabase write ~50-200ms) en fire-and-forget.
  // On génère le run_id localement pour émettre run_started immédiatement
  // (le signal visuel "réfléchit" arrive sans attendre le round-trip DB).
  // Le write Supabase se fait en parallèle — si échoue, le run reste en
  // mémoire (storeRun) et la persistance DB est best-effort pour ce path.
  // RunEngine.create retourne le moteur dès que le run_id est alloué.
  const engine = await RunEngine.create(db, createInput, eventBus);
  // start() émet run_started synchroniquement (pas de I/O) — on peut l'await.
  await engine.start();
  console.info("[Orchestrator] run_started_latency", {
    run_id: engine.id,
    elapsed_ms: Date.now() - pipelineStartedAt,
  });

  // ── Abort plumbing : enregistre un AbortController dans le registry
  // global pour que POST /api/orchestrate/abort/[runId] puisse vraiment
  // couper le run (et pas seulement la connexion SSE côté client).
  const abortController = new AbortController();
  registerRun(engine.id, abortController);

  // ── Safety gate (BEFORE any tool exposure) ─────────────────
  // Hostile / abusive intents are refused here so we never propose a tool
  // call (and never trigger an OAuth card for an action that should never
  // happen). The model is also bypassed — pure cost saving + zero risk of
  // jailbreak from this point on.
  // Toggleable via the `safety_gate_enabled` feature flag (default: true) so
  // operators can flip it from the admin canvas for debug or red-team runs.
  const safetyEnabled = await isFeatureEnabled(db, "safety_gate_enabled", scope.tenantId, true);
  const safety = safetyEnabled ? checkSafetyGate(input.message) : { kind: "ok" as const };
  if (safety.kind !== "ok") {
    logger.info(
      { kind: safety.kind, reason: safety.reason },
      "[Orchestrator] Safety gate triggered",
    );
    eventBus.emit({
      type: "orchestrator_log",
      run_id: engine.id,
      message: `Safety gate ${safety.kind}: ${safety.reason}`,
    });
    eventBus.emit({
      type: "text_delta",
      run_id: engine.id,
      delta: safety.userMessage,
    });
    await engine.complete();
    return;
  }

  // ── Composio fast-path (direct-API read, ~2-2.5s saved) ───────────────────
  // Pour les ~5 intentions de lecture les plus fréquentes (Gmail, Calendar,
  // Drive, Slack, GitHub), on détecte l'intent par regex AVANT le LLM et on
  // exécute l'action Composio DIRECTEMENT — court-circuitant l'injection des
  // schémas (~4500 tokens) + le tour LLM de routing.
  //
  // FEATURE FLAG : `HELM_COMPOSIO_FASTPATH=1` requis (défaut OFF).
  // → Si le flag est absent (prod par défaut), ce bloc est entièrement sauté
  //   et le comportement est IDENTIQUE à avant. C'est la garantie de sécurité.
  //
  // Garde-fous :
  // - detectFastPathAction retourne null sur tout write ou référence contexte.
  // - Tout échec Composio (res.ok=false, exception) → fall-through pipeline.
  // - Jamais de message d'erreur user exposé ici : si ça échoue, l'agent prend.
  // P1 — entity fallback : composioEntityId n'est peuplé qu'en impersonation
  // Hive ; pour un user Helm natif il est undefined → on retombe sur userId,
  // exactement comme ai-pipeline.ts:605 le fait pour le pipeline complet.
  const fastPathEntity = input.composioEntityId ?? input.userId;
  // P2a — ne pas court-circuiter quand une VRAIE policy Cortex restreint les tools.
  // On ne skippe le fast-path que si la source est "cortex" (résolution dynamique
  // Context/Cortex) — pas quand la source est "legacy" (allowlist par défaut
  // hardcodée, ~8-10 entrées), qui n'est PAS une policy restrictive.
  // Sans ce guard précis, le fast-path était systématiquement inerte car
  // _allowedTools contient toujours des entrées legacy au moment de cette ligne.
  const hasPolicyRestriction =
    input._allowedToolsSource === "cortex" &&
    Array.isArray(input._allowedTools) &&
    input._allowedTools.length > 0;
  if (process.env.HELM_COMPOSIO_FASTPATH === "1" && fastPathEntity && !hasPolicyRestriction) {
    const fp = detectFastPathAction(input.message);
    if (fp) {
      logger.info(
        { slug: fp.slug, entity: fastPathEntity, run_id: engine.id },
        "[Orchestrator] composio fast-path triggered",
      );
      try {
        const { executeComposioAction } = await import("@/lib/connectors/composio/client");
        const res = await executeComposioAction({
          action: fp.slug,
          entityId: fastPathEntity,
          params: fp.args,
        });
        if (res.ok) {
          eventBus.emit({
            type: "execution_mode_selected",
            run_id: engine.id,
            mode: "direct_answer",
            reason: `Composio fast-path: ${fp.slug}`,
          });
          // Formatage minimal : on sérialise le résultat brut en texte lisible.
          // Pas de tour LLM en phase 1 — l'agent le prendra si le format est
          // trop brut (mais ~90% des cas c'est un JSON structuré exploitable).
          const raw = typeof res.data === "string" ? res.data : JSON.stringify(res.data, null, 2);
          eventBus.emit({
            type: "text_delta",
            run_id: engine.id,
            delta: raw,
          });
          console.info("[Orchestrator] composio_fastpath_done", {
            run_id: engine.id,
            slug: fp.slug,
            total_ms: Date.now() - pipelineStartedAt,
          });
          // P2b — persister la réponse assistant pour ne pas trouer l'historique.
          // Le message USER a déjà été persisté en amont (~ligne 270).
          // On reproduit le même pattern que storeAssistantMemory() (~ligne 798).
          if (input.conversationId) {
            await appendMessage(
              input.conversationId,
              {
                role: "assistant",
                content: raw,
                createdAt: Date.now(),
              },
              scope,
            );
            void appendToSummary({
              userId: input.userId,
              role: "assistant",
              content: raw,
            });
          }
          await engine.complete();
          return;
        }
        // res.ok=false → fall-through silencieux vers le pipeline complet
        logger.warn(
          { slug: fp.slug, error: res.error, errorCode: res.errorCode },
          "[Orchestrator] composio fast-path miss — falling through to full pipeline",
        );
      } catch (err) {
        // Exception → fall-through silencieux (jamais d'erreur user)
        logger.warn(
          { slug: fp.slug, err: err instanceof Error ? err.message : String(err) },
          "[Orchestrator] composio fast-path exception — falling through to full pipeline",
        );
      }
    }
  }

  // ── Composio lite-agent (Stream E — K2.5 classify+execute+summarize) ─────────
  // Généralise le fast-path regex à TOUTES les apps connectées de l'user, via un
  // appel K2.5 cheap (classify+resolve) qui reçoit uniquement les NOMS des read
  // actions (jamais les schémas complets) + un appel K2.5 summarize pour la prose.
  //
  // FEATURE FLAG : ACTIVÉ PAR DÉFAUT (opt-out). Kill-switch : `HELM_COMPOSIO_LITE_AGENT=0`.
  // → Le lite-agent traite toute lecture simple mono-tool (toutes apps connectées) en
  //   prose (~9.7s) sans injecter les schémas. Reads-only, fail-soft TOTAL : au moindre
  //   doute (write, multi-step, contexte, échec) il retombe sur le pipeline complet.
  //
  // Guards :
  // - entity = composioEntityId ?? userId (impersonation Hive)
  // - skip si _allowedToolsSource === "cortex" (policy Cortex restrictive)
  // - skip si smalltalk pur (isPureConversational) → évite un classify K2.5 inutile ;
  //   le fast-path conversationnel (plus bas) le prend pour ~0.5s
  // - fail-soft : tryLiteAgent retourne null → fall-through silencieux
  if (
    process.env.HELM_COMPOSIO_LITE_AGENT !== "0" &&
    fastPathEntity &&
    !hasPolicyRestriction &&
    !isPureConversational(input.message)
  ) {
    try {
      const { tryLiteAgent } = await import("./lite-agent");
      const liteResult = await tryLiteAgent({
        message: input.message,
        entityId: fastPathEntity,
        conversationId: input.conversationId,
      });
      if (liteResult) {
        logger.info(
          { slug: liteResult.slug, entity: fastPathEntity, run_id: engine.id },
          "[Orchestrator] lite-agent fast-path triggered",
        );
        eventBus.emit({
          type: "execution_mode_selected",
          run_id: engine.id,
          mode: "direct_answer",
          reason: `Lite-agent fast-path: ${liteResult.slug}`,
        });
        eventBus.emit({
          type: "text_delta",
          run_id: engine.id,
          delta: liteResult.text,
        });
        console.info("[Orchestrator] lite_agent_done", {
          run_id: engine.id,
          slug: liteResult.slug,
          total_ms: Date.now() - pipelineStartedAt,
        });
        // Persister la réponse assistant pour ne pas trouer l'historique.
        if (input.conversationId) {
          await appendMessage(
            input.conversationId,
            {
              role: "assistant",
              content: liteResult.text,
              createdAt: Date.now(),
            },
            scope,
          );
          void appendToSummary({
            userId: input.userId,
            role: "assistant",
            content: liteResult.text,
          });
        }
        await engine.complete();
        return;
      }
      // null → fall-through silencieux vers le pipeline complet
    } catch (err) {
      // Exception → fall-through silencieux (jamais d'erreur user)
      logger.warn(
        { err: err instanceof Error ? err.message : String(err) },
        "[Orchestrator] lite-agent exception — falling through to full pipeline",
      );
    }
  }

  // ── Conversational fast-path (< 1s) ────────────────────────
  // Smalltalk pur (salutation, merci, "qui es-tu") : aucun contexte ni tool
  // requis. On court-circuite AVANT le pré-fetch mémoire/KG/LTM, la discovery
  // Composio et le system prompt de ~4500 tokens — qui coûtent 1.5-3s pour rien.
  // gpt-4.1-mini + prompt court ≈ 0.5-0.7s. Conservateur : au moindre signal
  // d'action/donnée, isPureConversational retourne false → pipeline complet.
  if (isPureConversational(input.message)) {
    const fastPathStartedAt = Date.now();
    logger.info({ run_id: engine.id }, "[Orchestrator] conversational fast-path");
    eventBus.emit({
      type: "execution_mode_selected",
      run_id: engine.id,
      mode: "direct_answer",
      reason: "Conversational fast-path",
    });
    await runConversationalFastpath(input.message, engine, eventBus, {
      history: input.conversationHistory,
      signal: abortController.signal,
    });
    console.info("[Orchestrator] conversational_fastpath_done", {
      run_id: engine.id,
      elapsed_ms: Date.now() - fastPathStartedAt,
      total_ms: Date.now() - pipelineStartedAt,
    });
    return;
  }

  // ── Init RunRecord for history ─────────────────────────────
  const runRecord: RunRecord = {
    id: engine.id,
    tenantId: scope.tenantId,
    workspaceId: scope.workspaceId,
    userId: input.userId,
    input: input.message,
    surface: input.surface,
    executionMode: decision.mode,
    missionId: input.missionId,
    createdAt: Date.now(),
    status: "running",
    events: [],
    assets: [],
  };
  storeRun(runRecord);

  // Persist to Supabase (fire-and-forget)
  void persistRun({
    id: engine.id,
    tenantId: scope.tenantId,
    workspaceId: scope.workspaceId,
    userId: input.userId,
    input: input.message,
    surface: input.surface,
    executionMode: decision.mode,
    missionId: input.missionId,
    status: "running",
    createdAt: Date.now(),
    assets: [],
  });

  // Cleanup handled by eventBus.destroy() in orchestrate()
  void eventBus.on((event) => {
    if (event.run_id !== engine.id) return;
    runRecord.events.push(event);

    // Durable timeline persistence (fire-and-forget)
    if (shouldPersistEvent(event.type)) {
      void persistRunEvent({
        runId: engine.id,
        type: event.type,
        ts: new Date(event.timestamp).getTime(),
        payload: event as unknown as Record<string, unknown>,
      });
    }

    if (event.type === "asset_generated") {
      const ev = event as unknown as Record<string, unknown>;
      runRecord.assets.push({
        id: event.asset_id,
        name: event.name,
        type: event.asset_type,
        ...(ev.filePath
          ? {
              _filePath: ev.filePath as string,
              _fileName: ev.fileName as string,
              _mimeType: ev.mimeType as string,
              _sizeBytes: ev.sizeBytes as number,
            }
          : {}),
      });
    }
    if (event.type === "run_completed") {
      runRecord.status = "completed";
      runRecord.completedAt = Date.now();
      void persistUpdateRun(engine.id, {
        status: "completed",
        completedAt: runRecord.completedAt,
        assets: runRecord.assets,
      });
    }
    if (event.type === "run_failed") {
      runRecord.status = "failed";
      runRecord.completedAt = Date.now();
      void persistUpdateRun(engine.id, {
        status: "failed",
        completedAt: runRecord.completedAt,
      });
    }
  });

  // ── Emit tool surface (signal de transition d'état pour admin canvas) ─
  // Le contenu `tools` n'est plus consommé par l'UI principale (la palette
  // n'a jamais été implémentée côté user). On garde l'event pour les
  // transitions du graphe admin (intent → preflight → tools active) — il
  // suffit que l'event soit émis, son tableau peut rester vide.
  const toolContext = capScope.toolContext;
  eventBus.emit({
    type: "tool_surface",
    run_id: engine.id,
    context: toolContext,
    tools: [],
  });

  // ── Select agent (CUSTOM_AGENT mode) ────────────────────────
  // All execution modes flow through the same AI pipeline (streamText with
  // Composio tools). The agent record here is informational only — it
  // surfaces "which agent" the UI should display in the right panel.
  if (decision.mode === "custom_agent") {
    const agent = selectAgentForContext(toolContext);
    if (agent) {
      decision.agentId = agent.id;
      decision.backend = "hearst_runtime";

      runRecord.agentId = agent.id;
      runRecord.backend = "hearst_runtime";

      void persistUpdateRun(engine.id, {
        agentId: agent.id,
        backend: "hearst_runtime",
        executionMode: decision.mode,
      });

      eventBus.emit({
        type: "agent_selected",
        run_id: engine.id,
        agent_id: agent.id,
        agent_name: agent.name,
        allowed_tools: agent.allowedTools,
        backend: "hearst_runtime",
        backend_reason: "AI pipeline (streamText + Composio)",
      });

      eventBus.emit({
        type: "orchestrator_log",
        run_id: engine.id,
        message: `Routing to agent: ${agent.name}`,
      });
    }
  }

  // ── Emit mission triggered (if scheduler) ──────────────────
  if (input.missionId) {
    eventBus.emit({
      type: "scheduled_mission_triggered",
      run_id: engine.id,
      mission_id: input.missionId,
      name: input.message.slice(0, 80),
    });
  }

  // ── Emit execution mode to SSE ─────────────────────────────
  eventBus.emit({
    type: "execution_mode_selected",
    run_id: engine.id,
    mode: decision.mode,
    reason: decision.reason,
    backend: decision.backend,
  });

  // Instrumentation décision de sélection (obs) : pourquoi un tool a (ou n'a
  // pas) été choisi. tool_candidate_count = taille du toolset autorisé exposé
  // au LLM ; direct_answer_reason = raison du mode quand aucun tool n'est appelé.
  logger.info(
    {
      run_id: engine.id,
      mode: decision.mode,
      tool_candidate_count: input._allowedTools?.length ?? 0,
      direct_answer_reason: decision.mode === "direct_answer" ? decision.reason : null,
      allowed_tools_source: input._allowedToolsSource ?? "legacy",
    },
    "[ExecutionMode] selection",
  );

  // ── 3. Capture assistant output for memory ─────────────────
  let assistantOutput = "";
  const unsubscribe = eventBus.on((event) => {
    if (event.type === "text_delta") {
      assistantOutput += event.delta;
    }
  });

  const storeAssistantMemory = async (): Promise<void> => {
    unsubscribe();
    if (input.conversationId && assistantOutput.length > 0) {
      // Await la WAL durable (~5ms Redis) avant de rendre la main : le
      // message assistant doit survivre au teardown du process serverless.
      await appendMessage(
        input.conversationId,
        {
          role: "assistant",
          content: assistantOutput,
          createdAt: Date.now(),
        },
        scope,
      );
      void appendToSummary({ userId: input.userId, role: "assistant", content: assistantOutput });
    }
  };

  // ── 4. Dispatch by execution mode ──────────────────────────
  try {
    // ── Provider preflight (skip for research — uses web, not user providers) ──
    //
    // The previous behaviour was to `engine.fail()` with an English message
    // ("X is not connected") whenever no provider was connected. That broke
    // dozens of trivial prompts — the routing keyword fix (F1) eliminates
    // most false positives, but even legitimately-blocked prompts deserve a
    // graceful path:
    //   - if the user *explicitly* mentioned the app (request from
    //     `getRequiredProvidersForInput` keyword match), surface
    //     `app_connect_required` and let the inline OAuth card take over.
    //   - if the routing only inferred the provider (no explicit mention),
    //     fall through to the AI pipeline so the model can clarify or
    //     answer without the missing provider.
    // Impersonation Hive : en mode `composioEntityId` (hive:<tenant>), les
    // connexions de l'utilisateur vivent dans Composio sous cet entity — que le
    // preflight control-plane (clé sur userId / tokens natifs Helm) ne sait PAS
    // voir → faux "provider non connecté" qui court-circuite avant l'AI pipeline.
    // On skippe donc ce gate déterministe et on laisse l'AI pipeline charger les
    // tools Composio sous composioEntityId ; son propre `app_connect_required`
    // (par tool, sur échec réel) reste le garde-fou précis.
    if (!researchDetected && !input.composioEntityId && scopeRequiresProviders(capScope)) {
      const providerReq = getRequiredProvidersForInput(input.message);
      const userExplicitlyMentioned = providerReq !== null;
      const providersToCheck = providerReq?.providers ?? capScope.providers;

      if (providersToCheck.length > 0) {
        const preflightResults = await Promise.all(
          providersToCheck.map((p) =>
            preflightConnector({ provider: p, scope, userId: input.userId }),
          ),
        );
        const anyConnected = preflightResults.some((r) => r.ok);

        if (!anyConnected) {
          const capability = providerReq?.capability ?? capScope.capabilities[0] ?? capScope.domain;
          logger.info(
            { capability, explicit: userExplicitlyMentioned, providers: providersToCheck },
            "[Orchestrator] Provider absent",
          );

          if (userExplicitlyMentioned) {
            // The user named the app — surface the OAuth card via the canonical
            // event the AI pipeline already uses, so the UI shows
            // `ChatConnectInline` instead of a hard run failure.
            const userMessage =
              providerReq?.userMessage ?? getBlockedReasonForProviders(providersToCheck);

            for (const app of providersToCheck) {
              eventBus.emit({
                type: "app_connect_required",
                run_id: engine.id,
                app,
                reason: userMessage,
              });
            }

            eventBus.emit({
              type: "orchestrator_log",
              run_id: engine.id,
              message: `Provider needed: ${capability} → ${providersToCheck.join(", ")}`,
            });

            eventBus.emit({
              type: "text_delta",
              run_id: engine.id,
              delta: userMessage,
            });

            // Successful, controlled completion — not a failure.
            await engine.complete();
            return;
          }

          // Inferred (false-positive) routing: drop the preflight and let the
          // AI pipeline run normally. The model can still clarify or fall back
          // to general chat.
          eventBus.emit({
            type: "orchestrator_log",
            run_id: engine.id,
            message: `Routing inferred ${capability} but user didn't mention it — falling through to AI pipeline`,
          });
        }
      }
    }

    // ── Reasoning path — DeepSeek R1 ───────────────────────────
    // Fail-soft : si DEEPSEEK_API_KEY absent ou si l'appel échoue, on
    // retombe sur handleAiPipeline (Sonnet 4.6 avec extended thinking).
    // L'audit E2E 2026-05-08 1.3 a montré que la branche n'était jamais
    // empruntée — capScope.intent est maintenant détecté indépendamment
    // de la clé, donc on doit gérer le cas "détecté mais pas dispo".
    if (capScope.intent === "reasoning") {
      if (!process.env.DEEPSEEK_API_KEY) {
        eventBus.emit({
          type: "orchestrator_log",
          run_id: engine.id,
          message:
            "Reasoning intent detected but DEEPSEEK_API_KEY absent — falling back to AI pipeline (Sonnet)",
        });
      } else {
        try {
          eventBus.emit({
            type: "orchestrator_log",
            run_id: engine.id,
            message: "Routing to DeepSeek R1 (reasoning intent detected)",
          });

          const { deepseekChat } = await import("@/lib/capabilities/providers/deepseek");
          const messages: Array<{ role: "user" | "assistant" | "system"; content: string }> = [
            ...(input.conversationHistory ?? []),
            { role: "user", content: input.message },
          ];

          const result = await deepseekChat({ messages, maxTokens: 8192 });

          if (result.reasoningContent) {
            eventBus.emit({
              type: "text_delta",
              run_id: engine.id,
              delta: `<think>${result.reasoningContent}</think>\n\n`,
            });
          }
          eventBus.emit({ type: "text_delta", run_id: engine.id, delta: result.content });
          await engine.complete();
          return;
        } catch (err) {
          console.warn("[Orchestrator] DeepSeek R1 failed — fallback to AI pipeline:", err);
          eventBus.emit({
            type: "orchestrator_log",
            run_id: engine.id,
            message: `DeepSeek R1 unavailable (${err instanceof Error ? err.message.slice(0, 100) : "unknown"}) — fallback to AI pipeline`,
          });
          // Fall through to handleAiPipeline below
        }
      }
    }

    // ── Deterministic research path ────────────────────────────
    // Research / report intents (« cherche … », « rapport sur … ») use a
    // deterministic web-search pipeline rather than streamText. Everything
    // else routes to the AI pipeline below.
    //
    // EXCEPTIONS — on bypasse le research path quand :
    //  1. Schedule directive (« tous les matins ») : le research path est
    //     one-shot et ne connaît pas `create_scheduled_mission` → ai-pipeline.
    //  2. Catalogue template request (« founder cockpit », « financial pnl »…) :
    //     le research path web-only ne sait pas composer cross-app → ai-pipeline
    //     pour que Sonnet appelle `propose_report_spec`.
    //  3. Native deterministic tool match (« prix du bitcoin », « cours AAPL »…) :
    //     le research path renverrait des liens externes → ai-pipeline pour que
    //     Sonnet appelle `get_crypto_prices` / `get_stock_quotes` (live, no key).
    const bypassResearch = shouldBypassResearchPath(input.message);
    if (researchDetected && !scheduleDetected && !bypassResearch) {
      const pathLabel = reportDetected ? "research + report" : "research";
      eventBus.emit({
        type: "orchestrator_log",
        run_id: engine.id,
        message: `${pathLabel} intent detected — using deterministic research path`,
      });
      await runResearchReport({
        message: input.message,
        engine,
        eventBus,
        scope,
        threadId: input.threadId,
      });
      return;
    }
    if (researchDetected && bypassResearch) {
      eventBus.emit({
        type: "orchestrator_log",
        run_id: engine.id,
        message:
          "Research keywords detected but request matches catalogue template or native tool — routing to AI pipeline",
      });
    }

    // ── Mission Control planner (B1) ─────────────────────────
    // Si l'intention est complexe ET le feature flag est ON, on route vers
    // le planner multi-step (preview → execution step-by-step). Fail-soft :
    // tout crash retombe sur runAiPipeline, jamais bloquant pour le user.
    if (isPlannerEnabled() && isComplexIntent(input.message)) {
      eventBus.emit({
        type: "orchestrator_log",
        run_id: engine.id,
        message: "Complex intent detected — routing to planner workflow",
      });
      try {
        await runPlannerWorkflow(engine, eventBus, {
          userId: input.userId,
          tenantId: scope.tenantId,
          workspaceId: scope.workspaceId,
          threadId: input.threadId ?? input.conversationId ?? engine.id,
          message: input.message,
        });
        await engine.complete();
        return;
      } catch (err) {
        console.error("[Orchestrator] planner crash — fallback to AI pipeline:", err);
        eventBus.emit({
          type: "orchestrator_log",
          run_id: engine.id,
          message: `Planner failed (${err instanceof Error ? err.message : "unknown"}) — fallback to AI pipeline`,
        });
        // Fall through to handleAiPipeline below
      }
    }

    // Every other execution mode flows through the same AI pipeline. The
    // model decides which provider tools to call (Gmail, Calendar, Slack…)
    // — there is no orchestrator-level pre-fetch of user data.
    await handleAiPipeline(
      engine,
      eventBus,
      input,
      scope,
      abortController.signal,
      decision.mode,
      executionTier,
    );
  } finally {
    if (abortController.signal.aborted) {
      eventBus.emit({
        type: "run_aborted",
        run_id: engine.id,
        reason: "client_requested",
      });
    }
    unregisterRun(engine.id);
    await storeAssistantMemory();
  }
}

// ── Unified Orchestrator Exports ─────────────────────────

// The orchestrator has been unified. All exports are now from this file.
// orchestrateV2 and orchestrate are now the same unified implementation.
