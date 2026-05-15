/**
 * Extras Services tools — exposés à la pipeline IA.
 *
 * Wrap les services premium câblés dans Hearst OS pour qu'ils soient
 * appelables par l'agent orchestrator. Tous les tools sont fail-soft :
 * si la clé d'env est absente, le tool retourne un message clair plutôt
 * que de throw.
 *
 * - send_email : envoie un email transactionnel via Resend
 * - query_sentry_issues : liste les errors récentes (debug agent)
 * - query_axiom_logs : recherche logs structurés
 * - schedule_inngest_job : programme un event Inngest (cron / one-off)
 * - query_langfuse_traces : recherche traces LLM passées
 */

import type { Tool } from "ai";
import { jsonSchema } from "ai";
import { Resend } from "resend";
import { inngest, isInngestEnabled } from "@/lib/jobs/inngest/client";
import {
  hashToolArgs,
  issueConfirmationToken,
  verifyConfirmationToken,
} from "@/lib/tools/hitl/confirmation-token";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AiToolMap = Record<string, Tool<any, any>>;

// ── Inline Resend client (le wrapper lib/platform/email/resend.ts a été retiré) ──
let _resendClient: Resend | null = null;
function getResend(): Resend | null {
  if (_resendClient) return _resendClient;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  _resendClient = new Resend(apiKey);
  return _resendClient;
}
const isResendEnabled = (): boolean => Boolean(process.env.RESEND_API_KEY);
const DEFAULT_FROM = process.env.RESEND_FROM_EMAIL ?? "Hearst OS <noreply@hearst.app>";

async function sendEmail(params: {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
}): Promise<{ id?: string; error?: string }> {
  const client = getResend();
  if (!client) return { error: "resend_not_configured" };
  try {
    const { data, error } = await client.emails.send({
      from: params.from ?? DEFAULT_FROM,
      to: params.to,
      subject: params.subject,
      html: params.html ?? "",
      text: params.text,
    });
    if (error) return { error: error.message };
    return { id: data?.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "unknown_error" };
  }
}

// ── send_email ────────────────────────────────────────────────────

interface SendEmailArgs {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  /**
   * F-010 : gate HITL cryptographique.
   * - Absent ou true → draft preview + nouveau confirmationToken émis.
   * - Présent (string HMAC) → verifyConfirmationToken → exécution si valide.
   * Le LLM ne peut pas forger un token valide (ne connaît pas NEXTAUTH_SECRET).
   */
  _preview?: boolean;
  _confirmationToken?: string;
}

const SEND_EMAIL_TOOL_SLUG = "send_email";

function buildSendEmailTool(scope?: {
  userId: string;
  tenantId: string;
}): Tool<SendEmailArgs, unknown> {
  return {
    description:
      "Envoie un email transactionnel via Resend. ⚠️ Action irréversible. Appelle TOUJOURS sans _confirmationToken d'abord pour obtenir un draft à confirmer. N'exécute l'envoi que si l'utilisateur fournit le _confirmationToken reçu. Use this when the user asks to 'envoie un email à X', 'rappelle Y par email', 'follow-up Z'.",
    inputSchema: jsonSchema<SendEmailArgs>({
      type: "object",
      required: ["to", "subject"],
      properties: {
        to: {
          oneOf: [
            { type: "string", description: "Une adresse email (ex: alice@example.com)." },
            { type: "array", items: { type: "string" }, description: "Plusieurs destinataires." },
          ],
        },
        subject: { type: "string", description: "Objet de l'email (court, < 80 chars)." },
        html: { type: "string", description: "Corps HTML (optionnel si text fourni)." },
        text: { type: "string", description: "Corps texte brut (optionnel si html fourni)." },
        from: { type: "string", description: "Expéditeur (default: env RESEND_FROM_EMAIL)." },
        _preview: {
          type: "boolean",
          description:
            "Ignoré si _confirmationToken fourni. true (défaut) = retourne un draft sans envoyer.",
          default: true,
        },
        _confirmationToken: {
          type: "string",
          description:
            "Token HMAC signé émis lors du draft précédent. Obligatoire pour déclencher l'envoi réel.",
        },
      },
    }),
    execute: async (args) => {
      // F-010 : exécution uniquement si token HMAC valide.
      if (args._confirmationToken) {
        // Sans scope (contexte hors-pipeline), on ne peut pas vérifier → draft.
        if (!scope) {
          return "Erreur : contexte utilisateur manquant, impossible de vérifier le token de confirmation.";
        }
        // Args canoniques = tout sauf les champs de contrôle HITL.
        const { _preview: _p, _confirmationToken: _t, ...execArgs } = args;
        const argsHash = hashToolArgs(execArgs);
        const result = verifyConfirmationToken(args._confirmationToken, {
          userId: scope.userId,
          tenantId: scope.tenantId,
          toolSlug: SEND_EMAIL_TOOL_SLUG,
          argsHash,
        });
        if (!result.ok) {
          return `Envoi refusé : token de confirmation invalide (${result.reason}). Refais d'abord un draft pour obtenir un nouveau token.`;
        }
        // Token valide → exécution.
        if (!isResendEnabled()) {
          return "Resend n'est pas configuré (RESEND_API_KEY manquante). Email non envoyé.";
        }
        if (!args.html && !args.text) {
          return "Erreur : il faut fournir au moins `html` ou `text` pour le corps de l'email.";
        }
        const sendResult = await sendEmail({
          to: args.to,
          subject: args.subject,
          html: args.html,
          text: args.text,
          from: args.from,
        });
        if (sendResult.error) {
          return `Échec envoi email : ${sendResult.error}`;
        }
        return `Email envoyé. id=${sendResult.id ?? "?"}`;
      }

      // Pas de token → draft preview + émission du token de confirmation.
      const toStr = Array.isArray(args.to) ? args.to.join(", ") : args.to;
      const { _preview: _p2, _confirmationToken: _t2, ...draftArgs } = args;
      const confirmationToken = scope
        ? issueConfirmationToken({
            userId: scope.userId,
            tenantId: scope.tenantId,
            toolSlug: SEND_EMAIL_TOOL_SLUG,
            argsHash: hashToolArgs(draftArgs),
          })
        : null;

      return {
        kind: "draft",
        action: "send_email",
        to: toStr,
        subject: args.subject,
        body_preview: (args.text ?? args.html ?? "").slice(0, 200),
        drafted_at: new Date().toISOString(),
        _confirmationToken: confirmationToken,
        message:
          "Draft email — transmets le _confirmationToken à l'utilisateur pour qu'il confirme l'envoi.",
      };
    },
  };
}

// ── query_sentry_issues ───────────────────────────────────────────

interface QuerySentryIssuesArgs {
  query?: string;
  limit?: number;
}

const querySentryIssuesTool: Tool<QuerySentryIssuesArgs, unknown> = {
  description:
    "Liste les issues récentes (errors capturées) sur Sentry pour le projet hearst-os. Use this when the user asks 'quelles erreurs ont été remontées', 'pourquoi mon app a planté', 'show me the latest crashes'.",
  inputSchema: jsonSchema<QuerySentryIssuesArgs>({
    type: "object",
    properties: {
      query: { type: "string", description: "Filtre Sentry (ex: 'is:unresolved level:error')." },
      limit: { type: "number", description: "Max d'issues à retourner (default 10, max 25)." },
    },
  }),
  execute: async (args) => {
    const token = process.env.SENTRY_AUTH_TOKEN;
    const org = process.env.SENTRY_ORG ?? "adrien-debug";
    const project = process.env.SENTRY_PROJECT;
    if (!token || !project) {
      return "Sentry non configuré (SENTRY_AUTH_TOKEN ou SENTRY_PROJECT manquant).";
    }
    const limit = Math.min(args.limit ?? 10, 25);
    const query = args.query ?? "is:unresolved";
    try {
      const url = new URL(`https://de.sentry.io/api/0/projects/${org}/${project}/issues/`);
      url.searchParams.set("query", query);
      url.searchParams.set("limit", String(limit));
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return `Sentry HTTP ${res.status}`;
      const issues = (await res.json()) as Array<{
        id: string;
        title: string;
        culprit?: string;
        count?: string;
        lastSeen?: string;
        permalink?: string;
        level?: string;
      }>;
      if (issues.length === 0) return "Aucune issue Sentry pour cette query.";
      const summary = issues.map((i, idx) => {
        const count = i.count ?? "?";
        const last = i.lastSeen ? new Date(i.lastSeen).toLocaleString("fr-FR") : "?";
        return `${idx + 1}. [${i.level ?? "?"}] ${i.title} — ${count}× — last ${last}`;
      });
      return [`${issues.length} issue(s) Sentry :`, ...summary].join("\n");
    } catch (err) {
      return `Erreur Sentry : ${err instanceof Error ? err.message : String(err)}`;
    }
  },
};

// ── query_axiom_logs ──────────────────────────────────────────────

interface QueryAxiomLogsArgs {
  apl: string;
  startTime?: string;
  endTime?: string;
}

// F-048: query_axiom_logs est admin-only (accès à tous les logs) ou scoped (mon userId)
const queryAxiomLogsTool: Tool<QueryAxiomLogsArgs, unknown> = {
  description:
    "Exécute une query APL (Axiom Processing Language) sur les logs structurés. ADMIN ONLY : retourne tous les logs. Use this when the user asks 'combien d'utilisateurs ont fait X aujourd'hui', 'analyse l'activité de la dernière heure', 'cherche les logs avec error'. APL doc : https://axiom.co/docs/apl/introduction.",
  inputSchema: jsonSchema<QueryAxiomLogsArgs>({
    type: "object",
    required: ["apl"],
    properties: {
      apl: {
        type: "string",
        description:
          "Query APL valide (ex: \"['hearst-vercel'] | where ['level'] == 'error' | take 10\").",
      },
      startTime: { type: "string", description: "ISO 8601 — début (default: now-1h)." },
      endTime: { type: "string", description: "ISO 8601 — fin (default: now)." },
    },
  }),
  execute: async (args) => {
    // F-048: Cette tool est accessible uniquement à des agents admin (non-user-facing).
    // Si elle est exposée dans le contexte user, elle doit être filtrée.
    // Pour maintenant, on la retourne brute pour les tests — à filtrer au build du toolset user.
    const token = process.env.AXIOM_TOKEN;
    if (!token) return "Axiom non configuré (AXIOM_TOKEN manquant).";
    try {
      const res = await fetch("https://api.axiom.co/v1/datasets/_apl?format=tabular", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          apl: args.apl,
          startTime: args.startTime ?? new Date(Date.now() - 3600_000).toISOString(),
          endTime: args.endTime ?? new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        const text = await res.text();
        return `Axiom HTTP ${res.status} : ${text.slice(0, 200)}`;
      }
      const data = (await res.json()) as {
        tables?: Array<{ columns?: Array<{ name: string }>; rows?: unknown[][] }>;
        matches?: Array<{ data: Record<string, unknown> }>;
      };
      const rows = data.tables?.[0]?.rows ?? data.matches?.map((m) => m.data) ?? [];
      const count = Array.isArray(rows) ? rows.length : 0;
      if (count === 0) return "Aucun résultat pour cette query Axiom.";
      const sample = JSON.stringify(rows.slice(0, 5), null, 2);
      return `${count} résultat(s) Axiom (5 premiers) :\n${sample}`;
    } catch (err) {
      return `Erreur Axiom : ${err instanceof Error ? err.message : String(err)}`;
    }
  },
};

// ── schedule_inngest_job ──────────────────────────────────────────

/**
 * F-102 — Whitelist stricte des events Inngest que le LLM peut déclencher.
 * Reject tout event hors liste pour empêcher la privilege escalation par prompt injection.
 * Un attaquant ne peut pas déclencher app/admin.* ou app/email.send directement.
 */
const INNGEST_EVENT_WHITELIST = new Set([
  "app/daily-brief.requested",
  "app/weekly-digest.requested",
  "app/monthly-card.requested",
]);

interface ScheduleInngestJobArgs {
  eventName: string;
  data: Record<string, unknown>;
  delaySeconds?: number;
}

const scheduleInngestJobTool: Tool<ScheduleInngestJobArgs, unknown> = {
  description:
    "Programme un event Inngest (job durable). Si `delaySeconds` est fourni, le job s'exécute après ce délai. Use this when the user asks 'programme la génération demain à 9h', 'lance ce job dans 1h', 'schedule a daily report'. Events disponibles : 'app/daily-brief.requested' (génère un brief), 'app/weekly-digest.requested', 'app/monthly-card.requested'.",
  inputSchema: jsonSchema<ScheduleInngestJobArgs>({
    type: "object",
    required: ["eventName", "data"],
    properties: {
      eventName: {
        type: "string",
        description:
          "Nom de l'event Inngest — doit être l'un des events autorisés : 'app/daily-brief.requested', 'app/weekly-digest.requested', 'app/monthly-card.requested'.",
      },
      data: {
        type: "object",
        description: "Payload JSON du job (dépend de l'event).",
      },
      delaySeconds: {
        type: "number",
        description: "Délai en secondes avant exécution (optionnel, default = immédiat).",
      },
    },
  }),
  execute: async (args) => {
    // F-102 : whitelist — rejeter tout event hors liste autorisée.
    if (!INNGEST_EVENT_WHITELIST.has(args.eventName)) {
      console.warn(`[schedule_inngest] Blocked unauthorized event: ${args.eventName}`);
      return `Erreur : l'event '${args.eventName}' n'est pas autorisé. Events disponibles : ${[...INNGEST_EVENT_WHITELIST].join(", ")}.`;
    }

    if (!isInngestEnabled()) {
      return "Inngest non configuré (INNGEST_EVENT_KEY manquant). Job non programmé.";
    }
    try {
      const ts = args.delaySeconds
        ? new Date(Date.now() + args.delaySeconds * 1000).toISOString()
        : undefined;
      const result = await inngest.send({
        name: args.eventName,
        data: args.data,
        ts: ts ? Date.parse(ts) : undefined,
      });
      const id = result.ids[0] ?? "?";
      const when = ts ? `à ${ts}` : "immédiatement";
      return `Job Inngest programmé ${when}. event=${args.eventName} id=${id}`;
    } catch (err) {
      return `Erreur Inngest : ${err instanceof Error ? err.message : String(err)}`;
    }
  },
};

// ── query_langfuse_traces ─────────────────────────────────────────

interface QueryLangfuseTracesArgs {
  userId?: string;
  limit?: number;
}

const queryLangfuseTracesTool: Tool<QueryLangfuseTracesArgs, unknown> = {
  description:
    "Liste les dernières traces LLM (appels Anthropic capturés par Langfuse). Use this when the user asks 'mes derniers prompts', 'analyse mes appels LLM récents', 'pourquoi mon dernier prompt a coûté autant'.",
  inputSchema: jsonSchema<QueryLangfuseTracesArgs>({
    type: "object",
    properties: {
      userId: { type: "string", description: "Filtrer sur un user ID (optionnel)." },
      limit: { type: "number", description: "Max de traces (default 10, max 50)." },
    },
  }),
  execute: async (args) => {
    const pk = process.env.LANGFUSE_PUBLIC_KEY;
    const sk = process.env.LANGFUSE_SECRET_KEY;
    if (!pk || !sk) return "Langfuse non configuré.";
    const host = process.env.LANGFUSE_HOST ?? "https://cloud.langfuse.com";
    const auth = Buffer.from(`${pk}:${sk}`).toString("base64");
    const limit = Math.min(args.limit ?? 10, 50);
    try {
      const url = new URL(`${host}/api/public/traces`);
      url.searchParams.set("limit", String(limit));
      if (args.userId) url.searchParams.set("userId", args.userId);
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Basic ${auth}` },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return `Langfuse HTTP ${res.status}`;
      const data = (await res.json()) as {
        data?: Array<{
          id: string;
          name?: string;
          timestamp?: string;
          totalCost?: number;
          metadata?: Record<string, unknown>;
        }>;
      };
      const traces = data.data ?? [];
      if (traces.length === 0) return "Aucune trace Langfuse.";
      const summary = traces.map((t, idx) => {
        const cost = t.totalCost ? `$${t.totalCost.toFixed(4)}` : "?";
        const ts = t.timestamp ? new Date(t.timestamp).toLocaleString("fr-FR") : "?";
        return `${idx + 1}. ${t.name ?? "?"} — ${cost} — ${ts}`;
      });
      return [`${traces.length} trace(s) Langfuse :`, ...summary].join("\n");
    } catch (err) {
      return `Erreur Langfuse : ${err instanceof Error ? err.message : String(err)}`;
    }
  },
};

// ── Public API ────────────────────────────────────────────────────

export function buildExtrasServicesTools(scope?: { userId: string; tenantId: string }): AiToolMap {
  return {
    send_email: buildSendEmailTool(scope),
    query_sentry_issues: querySentryIssuesTool,
    query_axiom_logs: queryAxiomLogsTool,
    schedule_inngest_job: scheduleInngestJobTool,
    query_langfuse_traces: queryLangfuseTracesTool,
  };
}
