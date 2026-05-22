/**
 * withApiAuth — HOF d'auth par clé API pour les routes /v1 (SDK serveur-à-serveur)
 *
 * Modélisé sur withScope (route-handler.ts) — même signature, même contrat d'erreur.
 *
 * Stratégie d'auth (ordre) :
 *   1. Bearer token → verifyApiKey → résolution tenant
 *   2. Fallback session NextAuth (requireScope) → pour que les routes /v1
 *      fonctionnent aussi depuis un navigateur authentifié
 *
 * Réponses d'erreur :
 *   401 { error: "missing_api_key" }   — ni Bearer ni session valide
 *   401 { error: "invalid_api_key" }   — Bearer présent mais clé invalide/révoquée
 */

import { type NextRequest, NextResponse } from "next/server";
import { type VerifiedApiKey, verifyApiKey } from "@/lib/platform/auth/api-key";
import { requireScope } from "@/lib/platform/auth/scope";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Contexte tenant résolu injecté dans le handler.
 * Compatible avec TenantScope mais sans workspaceId (inconnu pour les clés API).
 */
export interface ApiAuthTenant {
  tenantId: string;
  userId: string | null;
  scopes: string[];
  /** true si l'auth vient d'une session NextAuth plutôt que d'une clé API */
  fromSession: boolean;
}

/**
 * Contexte complet passé au handler — tenant résolu + params route.
 */
export interface ApiAuthContext<TParams = undefined> {
  tenant: ApiAuthTenant;
  params: TParams;
}

export type ApiAuthRouteHandler<TParams = undefined> = (
  req: NextRequest,
  ctx: ApiAuthContext<TParams>,
) => Promise<NextResponse | Response> | NextResponse | Response;

type NextRouteContext<TParams> = { params: Promise<TParams> } | undefined;

// ─── HOF ─────────────────────────────────────────────────────────────────────

/**
 * Wraps a route handler with API key auth (+ session fallback).
 *
 * Usage (no dynamic segment):
 *   export const GET = withApiAuth("GET /api/v1/foo", async (req, { tenant }) => {
 *     return NextResponse.json({ tenantId: tenant.tenantId });
 *   });
 *
 * Usage (dynamic segment):
 *   export const POST = withApiAuth<{ runId: string }>(
 *     "POST /api/v1/runs/[runId]/invoke",
 *     async (req, { tenant, params }) => {
 *       return NextResponse.json({ runId: params.runId });
 *     },
 *   );
 */
export function withApiAuth<TParams = Record<string, never>>(
  context: string,
  handler: ApiAuthRouteHandler<TParams>,
): (req: NextRequest, routeCtx?: NextRouteContext<TParams>) => Promise<NextResponse | Response> {
  return async (req, routeCtx) => {
    const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
    const params = ((await routeCtx?.params) ?? ({} as TParams)) as TParams;

    // ── Stratégie 1 : Bearer API Key ─────────────────────────────────────────
    if (authHeader?.startsWith("Bearer ")) {
      const rawKey = authHeader.slice("Bearer ".length).trim();

      if (!rawKey) {
        return NextResponse.json({ error: "missing_api_key" }, { status: 401 });
      }

      const verified: VerifiedApiKey | null = await verifyApiKey(rawKey);

      if (!verified) {
        console.warn(`[api-auth] invalid_api_key (${context})`);
        return NextResponse.json({ error: "invalid_api_key" }, { status: 401 });
      }

      const tenant: ApiAuthTenant = {
        tenantId: verified.tenantId,
        userId: verified.userId,
        scopes: verified.scopes,
        fromSession: false,
      };

      return handler(req, { tenant, params });
    }

    // ── Stratégie 2 : Fallback session NextAuth ───────────────────────────────
    // Permet aux routes /v1 d'être appelées depuis un browser connecté.
    const { scope, error } = await requireScope({ context });

    if (error || !scope) {
      // Ni Bearer ni session → 401 générique (ne pas révéler laquelle manque)
      return NextResponse.json({ error: "missing_api_key" }, { status: 401 });
    }

    const tenant: ApiAuthTenant = {
      tenantId: scope.tenantId,
      userId: scope.userId,
      scopes: ["read", "write"], // session active = accès complet par défaut
      fromSession: true,
    };

    return handler(req, { tenant, params });
  };
}

// ─── Guard de scope optionnel ─────────────────────────────────────────────────

/**
 * Vérifie qu'un tenant possède un scope requis.
 * À utiliser dans le handler après withApiAuth si une route est scope-gated.
 *
 * @example
 *   if (!hasApiScope(tenant, "write")) {
 *     return NextResponse.json({ error: "forbidden" }, { status: 403 });
 *   }
 */
export function hasApiScope(tenant: ApiAuthTenant, required: string): boolean {
  return tenant.scopes.includes(required) || tenant.scopes.includes("admin");
}
