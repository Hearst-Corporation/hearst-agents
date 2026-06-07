/**
 * Converts Composio DiscoveredTool[] into Vercel AI SDK v6 tool objects.
 *
 * Write actions (send, create, delete, update …) get a two-step HITL gate:
 *   1. `_preview: true`  (default) → returns a formatted draft, no side-effect.
 *   2. `_preview: false` + valid `_confirmationToken` → executes via Composio.
 *
 * Le token HMAC est émis côté serveur (jamais par le LLM). Un LLM compromis
 * par prompt injection ne peut pas se forger un token valide.
 *
 * Read-only tools bypass the gate entirely.
 */

import type { Tool } from "ai";
import { jsonSchema } from "ai";
import {
  hashToolArgs,
  issueConfirmationToken,
  verifyConfirmationToken,
} from "@/lib/tools/hitl/confirmation-token";
import { executeComposioAction } from "./client";
import type { DiscoveredTool } from "./discovery";
import { getFormatterForAction } from "./preview-formatters";
import { formatActionPreview, isWriteAction } from "./write-guard";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AiToolMap = Record<string, Tool<any, any>>;

/**
 * Retire récursivement les clés bruitées des schémas de paramètres Composio
 * (`example`, `examples`, `deprecated`) avant de les passer à streamText({ tools }).
 * Réduit réellement les tokens envoyés au LLM (c'est ici que les schémas voyagent).
 * Ne mute pas l'original : clone systématique.
 * NB : on conserve les `description` — le LLM en a besoin pour générer les bons args.
 */
export function stripSchemaNoise(params: unknown): unknown {
  if (Array.isArray(params)) return params.map(stripSchemaNoise);
  if (params !== null && typeof params === "object") {
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(params as Record<string, unknown>)) {
      if (k === "example" || k === "examples" || k === "deprecated") continue;
      cleaned[k] = stripSchemaNoise(v);
    }
    return cleaned;
  }
  return params;
}

function buildSchema(tool: DiscoveredTool, isWrite: boolean): Parameters<typeof jsonSchema>[0] {
  const rawParams =
    tool.parameters && typeof tool.parameters === "object"
      ? tool.parameters
      : { type: "object", properties: {} };
  const base = stripSchemaNoise(rawParams) as Record<string, unknown>;

  if (!isWrite) return base as Parameters<typeof jsonSchema>[0];

  // Inject _preview + _confirmationToken into write tool schemas.
  // Le LLM doit toujours passer _preview: true en premier (draft).
  // Pour exécuter, le token HMAC doit être fourni par le serveur (jamais
  // généré par le LLM lui-même).
  const baseProps = (base.properties as Record<string, unknown>) ?? {};
  return {
    ...base,
    properties: {
      ...baseProps,
      _preview: {
        type: "boolean",
        description:
          "Set to true (default) to show a draft before executing — ALWAYS do this first. " +
          "Set to false ONLY when the user has explicitly confirmed AND you have received a _confirmationToken from the server.",
        default: true,
      },
      _confirmationToken: {
        type: "string",
        description:
          "HMAC confirmation token issued by the server after the user confirmed the draft. " +
          "Required when _preview is false. Never fabricate this value.",
      },
    },
  } as Parameters<typeof jsonSchema>[0];
}

export interface ToAiToolsContext {
  userId: string;
  tenantId: string;
}

interface DraftResult {
  kind: "draft";
  preview: string;
  _confirmationToken: string;
  slug: string;
  args: Record<string, unknown>;
  drafted_at: string;
}

/**
 * Convertit les outils Composio en outils SDK v6.
 *
 * Le contexte doit toujours être { userId, tenantId } :
 * les anciens appelants passant un string ont été migrés.
 * Si un caller passe un string, TS erreur (good).
 */
export function toAiTools(tools: DiscoveredTool[], ctx: ToAiToolsContext): AiToolMap {
  const userId = ctx.userId;
  const tenantId = ctx.tenantId;

  return Object.fromEntries(
    tools.map((t): [string, Tool<unknown, unknown>] => {
      const write = isWriteAction(t.name);

      return [
        t.name,
        {
          description: t.description || t.name,
          inputSchema: jsonSchema(buildSchema(t, write)),
          execute: async (rawArgs: unknown) => {
            const args = (rawArgs ?? {}) as Record<string, unknown>;

            if (write) {
              const isPreview = args._preview !== false;
              // Strip internal gate params before forwarding to Composio
              const { _preview: _p, _confirmationToken, ...composioArgs } = args;

              if (isPreview) {
                // Si un formatter custom existe (top 10 actions), on
                // l'utilise pour un draft plus lisible. Sinon → generic.
                const customFormatter = getFormatterForAction(t.name);
                const preview = customFormatter
                  ? customFormatter(composioArgs)
                  : formatActionPreview(t.name, composioArgs);
                const token = issueConfirmationToken({
                  userId,
                  tenantId,
                  toolSlug: t.name,
                  argsHash: hashToolArgs(composioArgs),
                });
                return {
                  kind: "draft",
                  preview,
                  _confirmationToken: token,
                  slug: t.name,
                  args: composioArgs,
                  drafted_at: new Date().toISOString(),
                } satisfies DraftResult;
              }

              // _preview === false : exiger un token HMAC valide.
              // Sans token → refus explicite, aucun side-effect.
              if (!_confirmationToken || typeof _confirmationToken !== "string") {
                return {
                  ok: false,
                  errorCode: "CONFIRMATION_REQUIRED",
                  error: "confirmation_token_required",
                  kind: "confirmation_required",
                  slug: t.name,
                };
              }

              const argsHash = hashToolArgs(composioArgs);
              const verify = verifyConfirmationToken(_confirmationToken, {
                userId,
                tenantId,
                toolSlug: t.name,
                argsHash,
              });

              if (!verify.ok) {
                // Token invalide → draft protecteur, log côté serveur.
                console.warn(
                  `[HITL] Composio write blocked: tool=${t.name} reason=${verify.reason} userId=${userId}`,
                );
                return {
                  ok: false,
                  errorCode: "CONFIRMATION_INVALID",
                  error: `token_${verify.reason}`,
                  kind: "confirmation_required",
                  slug: t.name,
                };
              }

              return executeComposioAction({
                action: t.name,
                entityId: userId,
                params: composioArgs,
              });
            }

            // Read-only: execute directly
            return executeComposioAction({
              action: t.name,
              entityId: userId,
              params: args,
            });
          },
        },
      ];
    }),
  );
}
