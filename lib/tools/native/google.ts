/**
 * Native Google tools — exposés directement à la pipeline IA.
 *
 * Le user obtient les scopes Gmail / Calendar / Drive en read+write au
 * moment du SSO Google (cf. `lib/platform/auth/options.ts`). Ces tools
 * utilisent le client `getGoogleAuth(userId)` qui pioche les tokens
 * depuis la table `user_tokens` — pas de Composio, pas de 2e popup OAuth.
 *
 * Les write tools (`gmail_send_email`, `googlecalendar_create_event`)
 * suivent le même protocole `_preview: true|false` que les outils
 * Composio pour rester cohérents avec les boutons Confirmer/Annuler.
 */

import type { Tool } from "ai";
import { jsonSchema } from "ai";
import {
  createCalendarEvent,
  getTodayEvents,
  getUpcomingEvents,
} from "@/lib/connectors/google/calendar";
import { getRecentFiles } from "@/lib/connectors/google/drive";
import { getRecentEmails, sendEmail } from "@/lib/connectors/google/gmail";
import { getTokens } from "@/lib/platform/auth/tokens";
import {
  hashToolArgs,
  issueConfirmationToken,
  verifyConfirmationToken,
} from "@/lib/tools/hitl/confirmation-token";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AiToolMap = Record<string, Tool<any, any>>;

const SEND_PREVIEW_FOOTER =
  "\n\n↩ Réponds **confirmer** pour envoyer, ou **annuler** pour abandonner.";

const EVENT_PREVIEW_FOOTER =
  "\n\n↩ Réponds **confirmer** pour créer l'événement, ou **annuler** pour abandonner.";

function fmtSendDraft(args: {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
}): string {
  const lines = [
    `📧 Draft · GMAIL · Envoyer`,
    ``,
    `**to** : ${args.to}`,
    args.cc ? `**cc** : ${args.cc}` : "",
    args.bcc ? `**bcc** : ${args.bcc}` : "",
    `**subject** : ${args.subject}`,
    ``,
    args.body,
  ].filter(Boolean);
  return lines.join("\n") + SEND_PREVIEW_FOOTER;
}

function fmtEventDraft(args: {
  summary: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
  attendees?: string[];
}): string {
  const lines = [
    `📆 Draft · GOOGLE CALENDAR · Créer un événement`,
    ``,
    `**titre** : ${args.summary}`,
    `**début** : ${args.start}`,
    `**fin** : ${args.end}`,
    args.location ? `**lieu** : ${args.location}` : "",
    args.attendees && args.attendees.length > 0
      ? `**participants** : ${args.attendees.join(", ")}`
      : "",
    args.description ? `\n${args.description}` : "",
  ].filter(Boolean);
  return lines.join("\n") + EVENT_PREVIEW_FOOTER;
}

interface FetchEmailsArgs {
  limit?: number;
}

interface SendEmailArgs {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  /** Conservé pour compat — ignoré si _confirmationToken fourni. */
  _preview?: boolean;
  /** P0-11 : token HMAC signé serveur. Requis pour exécution réelle. */
  _confirmationToken?: string;
}

interface ListEventsArgs {
  scope?: "today" | "upcoming";
  days?: number;
  limit?: number;
}

interface CreateEventArgs {
  summary: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
  attendees?: string[];
  /** Conservé pour compat — ignoré si _confirmationToken fourni. */
  _preview?: boolean;
  /** P0-11 : token HMAC signé serveur. Requis pour exécution réelle. */
  _confirmationToken?: string;
}

interface ListFilesArgs {
  limit?: number;
}

const GMAIL_SEND_TOOL_SLUG = "gmail_send_email";
const GCAL_CREATE_TOOL_SLUG = "googlecalendar_create_event";

/** Timeout réseau par défaut sur tout appel Google (anti-hang). */
const GOOGLE_NETWORK_TIMEOUT_MS = 10_000;

/**
 * Résultat d'erreur structuré, lisible par le LLM. Même convention que les
 * tools Composio (`{ ok:false, error, ... }`) pour que le pipeline (et le
 * modèle) le traite comme un échec exploitable plutôt qu'un throw silencieux.
 */
interface GoogleToolError {
  ok: false;
  error: string;
  message: string;
}

/**
 * Mappe une erreur connector Google → message honnête pour l'utilisateur.
 * `getGoogleAuth` throw "not_authenticated" (aucun token) ou "token_revoked"
 * (révoqué après échecs répétés). Les autres erreurs (réseau, 5xx Google,
 * timeout) sont remontées telles quelles, sans fabrication.
 */
function toGoogleToolError(err: unknown, surface: string): GoogleToolError {
  const raw = err instanceof Error ? err.message : String(err);

  if (raw === "not_authenticated") {
    return {
      ok: false,
      error: "google_not_connected",
      message: `${surface} isn't connected for this account. Connect ${surface} to use this action.`,
    };
  }
  if (raw === "token_revoked") {
    return {
      ok: false,
      error: "google_token_revoked",
      message: `Your Google access was revoked. Reconnect Google to continue using ${surface}.`,
    };
  }
  if (raw === "google_timeout") {
    return {
      ok: false,
      error: "google_timeout",
      message: `${surface} didn't respond in time (timeout ${GOOGLE_NETWORK_TIMEOUT_MS / 1000}s). Please try again.`,
    };
  }
  return {
    ok: false,
    error: "google_error",
    message: `${surface} request failed: ${raw}`,
  };
}

/**
 * Exécute un appel connector Google avec :
 *  - timeout dur (AbortController-équivalent via Promise.race) pour éviter
 *    tout hang si l'API Google ne répond jamais ;
 *  - capture de toute exception → résultat d'erreur structuré (JAMAIS de
 *    throw qui ferait avorter le tour LLM sans réponse).
 */
async function runGoogleTool<T>(
  surface: string,
  fn: () => Promise<T>,
): Promise<T | GoogleToolError> {
  try {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("google_timeout")), GOOGLE_NETWORK_TIMEOUT_MS);
    });
    try {
      return await Promise.race([fn(), timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  } catch (err) {
    console.warn(`[native/google] ${surface} failed:`, err instanceof Error ? err.message : err);
    return toGoogleToolError(err, surface);
  }
}

/**
 * Build the native Google tool map for a user. Returns `{}` if the user
 * isn't connected to Google via NextAuth (no access token in user_tokens).
 *
 * P0-11 : si `scope` (avec tenantId) est fourni, les write tools
 * (gmail_send_email, googlecalendar_create_event) appliquent un gate HITL
 * cryptographique identique à send_email Resend — sans _confirmationToken
 * valide, le tool retourne un draft + token signé (jamais une exécution).
 * Sans scope (chemin legacy), on retombe sur le `_preview: bool` historique
 * (vulnérable au bypass LLM mais utilisé hors-pipeline).
 */
export async function buildNativeGoogleTools(
  userId: string,
  scope?: { userId: string; tenantId: string },
): Promise<AiToolMap> {
  let hasGoogle = false;
  try {
    const tokens = await getTokens(userId, "google");
    hasGoogle = Boolean(tokens?.accessToken);
  } catch {
    hasGoogle = false;
  }
  if (!hasGoogle) return {};

  const fetchEmails: Tool<FetchEmailsArgs, unknown> = {
    description:
      "Fetch the most recent inbox emails of the connected Google account. Use this when the user asks to summarize, list, or read emails.",
    inputSchema: jsonSchema<FetchEmailsArgs>({
      type: "object",
      properties: {
        limit: { type: "number", description: "Max number of emails (default 10, capped at 25)." },
      },
    }),
    execute: async (args: FetchEmailsArgs) => {
      const limit = Math.min(Math.max(args.limit ?? 10, 1), 25);
      return runGoogleTool("Gmail", () => getRecentEmails(userId, limit));
    },
  };

  const sendEmailTool: Tool<SendEmailArgs, unknown> = {
    description:
      "Send an email through the connected Google account. Two-step protocol: appelle TOUJOURS d'abord sans _confirmationToken pour obtenir un draft + token. Pour exécuter, refais l'appel avec le token HMAC fourni. Le LLM ne peut pas forger ce token.",
    inputSchema: jsonSchema<SendEmailArgs>({
      type: "object",
      required: ["to", "subject", "body"],
      properties: {
        to: { type: "string", description: "Recipient email." },
        subject: { type: "string" },
        body: { type: "string" },
        cc: { type: "string" },
        bcc: { type: "string" },
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
    execute: async (args: SendEmailArgs) => {
      // P0-11 : exécution uniquement si token HMAC valide. Sans scope on
      // ne peut PAS vérifier — fail-closed, on retourne le draft.
      if (args._confirmationToken) {
        if (!scope) {
          return "Erreur : contexte utilisateur manquant, impossible de vérifier le token de confirmation.";
        }
        const { _preview: _p, _confirmationToken: _t, ...execArgs } = args;
        const argsHash = hashToolArgs(execArgs);
        const result = verifyConfirmationToken(args._confirmationToken, {
          userId: scope.userId,
          tenantId: scope.tenantId,
          toolSlug: GMAIL_SEND_TOOL_SLUG,
          argsHash,
        });
        if (!result.ok) {
          return `Envoi refusé : token de confirmation invalide (${result.reason}). Refais d'abord un draft pour obtenir un nouveau token.`;
        }
        return runGoogleTool("Gmail", () =>
          sendEmail(userId, {
            to: args.to,
            subject: args.subject,
            body: args.body,
            cc: args.cc,
            bcc: args.bcc,
          }),
        );
      }

      // Pas de token → draft + émission du token (si scope présent).
      const { _preview: _p2, _confirmationToken: _t2, ...draftArgs } = args;
      const confirmationToken = scope
        ? issueConfirmationToken({
            userId: scope.userId,
            tenantId: scope.tenantId,
            toolSlug: GMAIL_SEND_TOOL_SLUG,
            argsHash: hashToolArgs(draftArgs),
          })
        : null;

      return {
        kind: "draft",
        action: GMAIL_SEND_TOOL_SLUG,
        preview: fmtSendDraft(args),
        drafted_at: new Date().toISOString(),
        _confirmationToken: confirmationToken,
      };
    },
  };

  const listEvents: Tool<ListEventsArgs, unknown> = {
    description:
      "List events from the connected Google Calendar. `scope: 'today'` returns today's events; `scope: 'upcoming'` returns events for the next N days (default 7).",
    inputSchema: jsonSchema<ListEventsArgs>({
      type: "object",
      properties: {
        scope: { type: "string", enum: ["today", "upcoming"], default: "upcoming" },
        days: {
          type: "number",
          description: "Window in days when scope is 'upcoming' (default 7).",
        },
        limit: { type: "number", description: "Max events (default 20, capped at 50)." },
      },
    }),
    execute: async (args: ListEventsArgs) => {
      const limit = Math.min(Math.max(args.limit ?? 20, 1), 50);
      if (args.scope === "today") {
        return runGoogleTool("Google Calendar", () => getTodayEvents(userId, limit));
      }
      const days = Math.min(Math.max(args.days ?? 7, 1), 60);
      return runGoogleTool("Google Calendar", () => getUpcomingEvents(userId, days, limit));
    },
  };

  const createEvent: Tool<CreateEventArgs, unknown> = {
    description:
      "Create an event on the connected Google Calendar. Two-step protocol: appelle TOUJOURS d'abord sans _confirmationToken pour obtenir un draft + token. Pour exécuter, refais l'appel avec le token HMAC fourni.",
    inputSchema: jsonSchema<CreateEventArgs>({
      type: "object",
      required: ["summary", "start", "end"],
      properties: {
        summary: { type: "string", description: "Event title." },
        start: { type: "string", description: "ISO 8601 start datetime with timezone." },
        end: { type: "string", description: "ISO 8601 end datetime with timezone." },
        description: { type: "string" },
        location: { type: "string" },
        attendees: { type: "array", items: { type: "string" } },
        _preview: { type: "boolean", default: true },
        _confirmationToken: {
          type: "string",
          description: "Token HMAC signé. Obligatoire pour créer réellement l'événement.",
        },
      },
    }),
    execute: async (args: CreateEventArgs) => {
      // P0-11 : gate HITL crypto identique à gmail_send_email.
      if (args._confirmationToken) {
        if (!scope) {
          return "Erreur : contexte utilisateur manquant, impossible de vérifier le token de confirmation.";
        }
        const { _preview: _p, _confirmationToken: _t, ...execArgs } = args;
        const argsHash = hashToolArgs(execArgs);
        const result = verifyConfirmationToken(args._confirmationToken, {
          userId: scope.userId,
          tenantId: scope.tenantId,
          toolSlug: GCAL_CREATE_TOOL_SLUG,
          argsHash,
        });
        if (!result.ok) {
          return `Création refusée : token de confirmation invalide (${result.reason}). Refais d'abord un draft pour obtenir un nouveau token.`;
        }
        return runGoogleTool("Google Calendar", () =>
          createCalendarEvent(userId, {
            summary: args.summary,
            start: args.start,
            end: args.end,
            description: args.description,
            location: args.location,
            attendees: args.attendees,
          }),
        );
      }

      const { _preview: _p2, _confirmationToken: _t2, ...draftArgs } = args;
      const confirmationToken = scope
        ? issueConfirmationToken({
            userId: scope.userId,
            tenantId: scope.tenantId,
            toolSlug: GCAL_CREATE_TOOL_SLUG,
            argsHash: hashToolArgs(draftArgs),
          })
        : null;

      return {
        kind: "draft",
        action: GCAL_CREATE_TOOL_SLUG,
        preview: fmtEventDraft(args),
        drafted_at: new Date().toISOString(),
        _confirmationToken: confirmationToken,
      };
    },
  };

  const listFiles: Tool<ListFilesArgs, unknown> = {
    description:
      "List the most recent files in the connected Google Drive. Use this to surface documents the user has been working on.",
    inputSchema: jsonSchema<ListFilesArgs>({
      type: "object",
      properties: {
        limit: { type: "number", description: "Max files (default 10, capped at 25)." },
      },
    }),
    execute: async (args: ListFilesArgs) => {
      const limit = Math.min(Math.max(args.limit ?? 10, 1), 25);
      return runGoogleTool("Google Drive", () => getRecentFiles(userId, limit));
    },
  };

  return {
    gmail_fetch_emails: fetchEmails,
    gmail_send_email: sendEmailTool,
    googlecalendar_list_events: listEvents,
    googlecalendar_create_event: createEvent,
    googledrive_list_files: listFiles,
  };
}

/**
 * App labels exposed by the native tool surface — used by
 * `buildAgentSystemPrompt` to list them in the OUTILS section.
 */
export const NATIVE_GOOGLE_TOOL_DESCRIPTORS = [
  {
    name: "GMAIL_FETCH_EMAILS",
    description: "Lis les emails récents de la boîte de réception Google connectée.",
  },
  {
    name: "GMAIL_SEND_EMAIL",
    description: "Envoie un email via le compte Google connecté (preview/confirm).",
  },
  {
    name: "GOOGLECALENDAR_LIST_EVENTS",
    description: "Liste les événements du Google Calendar connecté.",
  },
  {
    name: "GOOGLECALENDAR_CREATE_EVENT",
    description: "Crée un événement sur le Google Calendar connecté (preview/confirm).",
  },
  {
    name: "GOOGLEDRIVE_LIST_FILES",
    description: "Liste les fichiers récents du Google Drive connecté.",
  },
] as const;
