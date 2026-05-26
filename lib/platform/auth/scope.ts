/**
 * Canonical Scope Resolution — User/Tenant/Workspace
 *
 * Centralized helper for resolving the current execution scope.
 * All user-facing API routes MUST use this to ensure data isolation.
 *
 * Source de vérité : session.user.tenantId chargé depuis public.users.primary_tenant_id
 * dans le callback jwt() de NextAuth. Plus de lecture directe de process.env ici.
 *
 * Dev fallback explicite et bruyant — jamais silencieux.
 */

import { headers } from "next/headers";
import { getServerSession } from "next-auth";
import { redactId } from "@/lib/utils/redact";
import { API_KEY_PREFIX, verifyApiKey } from "./api-key";
import { getUserId } from "./get-user-id";
import { authOptions } from "./options";

export interface CanonicalScope {
  userId: string;
  tenantId: string;
  workspaceId: string;
  isDevFallback: boolean;
  /** Prénom (ou nom complet) de l'utilisateur connecté, tel qu'exposé par le provider OAuth. */
  userName?: string;
}

interface ResolveScopeOptions {
  /** Require explicit tenantId (no fallback) */
  requireTenant?: boolean;
  /** Require explicit workspaceId (no fallback) */
  requireWorkspace?: boolean;
  /** Context for logging (e.g., API route path) */
  context?: string;
}

const DEV_TENANT_ID = "dev-tenant";
const DEV_WORKSPACE_ID = "dev-workspace";

/**
 * Resolve the canonical scope for the current request.
 *
 * Flow:
 * 1. Get userId from session (auth required)
 * 2. Resolve tenantId/workspaceId from explicit params or env
 * 3. If missing, use dev fallback ONLY if explicitly allowed
 * 4. Log when dev fallback is used
 *
 * Returns null if auth fails or scope requirements not met.
 */
export async function resolveScope(
  options: ResolveScopeOptions = {},
): Promise<CanonicalScope | null> {
  const { requireTenant = false, requireWorkspace = false, context = "unknown" } = options;

  // F1a.1 — Service token short-circuit (Bearer hsk_*) pour backend-to-backend.
  // Si l'header `Authorization: Bearer hsk_*` est présent, on prend le path
  // service-account. Selon le résultat :
  //   - { matched: true, scope }   → return scope directement
  //   - { matched: true, scope: null } → return null (clé valide mais sans user_id, rejected)
  //   - { matched: false }         → fall-through au flow NextAuth normal
  const bearer = await resolveBearerScope(context);
  if (bearer.matched) return bearer.scope;

  const userId = await getUserId();
  if (!userId) {
    console.warn(`[Scope] Auth failed — no userId (${context})`);
    return null;
  }

  // Lecture depuis la session JWT (chargée depuis DB dans le callback jwt())
  // — source de vérité, pas depuis process.env.
  const session = await getServerSession(authOptions);
  const sessionTenantId =
    (session?.user as { tenantId?: string } | undefined)?.tenantId ??
    ((session as unknown as Record<string, unknown> | null)?.tenantId as string | undefined) ??
    null;
  const sessionWorkspaceId =
    (session?.user as { workspaceId?: string } | undefined)?.workspaceId ??
    ((session as unknown as Record<string, unknown> | null)?.workspaceId as string | undefined) ??
    null;
  // Prénom / nom depuis session.user.name (peuplé via token.name dans options.ts).
  const sessionUserName =
    (session?.user as { name?: string | null } | undefined)?.name ?? undefined;

  let tenantId: string | null = sessionTenantId;
  let workspaceId: string | null = sessionWorkspaceId;
  let isDevFallback = false;

  if (!tenantId || !workspaceId) {
    if (process.env.NODE_ENV === "production") {
      // Fail-closed en prod : session sans tenant = 401. Pas de fallback env.
      console.error(
        `[Scope] CRITICAL: session.tenantId absent en prod (${context}, user: ${redactId(userId)})`,
      );
      return null;
    }

    // DEV uniquement : fallback bruyant sur env vars / constants.
    // Permet de bosser sans flow OAuth complet en local.
    if (requireTenant && !tenantId) {
      console.error(
        `[Scope] Tenant required but not resolved (${context}, user: ${redactId(userId)})`,
      );
      return null;
    }
    if (requireWorkspace && !workspaceId) {
      console.error(
        `[Scope] Workspace required but not resolved (${context}, user: ${redactId(userId)})`,
      );
      return null;
    }

    tenantId = tenantId ?? process.env.HEARST_TENANT_ID ?? DEV_TENANT_ID;
    workspaceId = workspaceId ?? process.env.HEARST_WORKSPACE_ID ?? DEV_WORKSPACE_ID;
    isDevFallback = true;

    // Redact PII for log safety — tenantId/workspaceId peuvent contenir des
    // identifiants opaques (UUID, slug client). On garde les 8 premiers
    // caractères comme pour userId — suffisant pour debug, pas pour leak.
    console.warn(
      `[Scope] DEV fallback active — tenant: ${redactId(tenantId)}, workspace: ${redactId(workspaceId)} (${context}, user: ${redactId(userId)})`,
    );
  }

  return {
    userId,
    tenantId,
    workspaceId,
    isDevFallback,
    ...(sessionUserName ? { userName: sessionUserName } : {}),
  };
}

/**
 * Lit l'header `Authorization: Bearer hsk_*` et retourne un scope service-account
 * si la clé est valide via `verifyApiKey`.
 *
 * Retourne un wrapper discriminé :
 *   - `{ matched: false }` : pas d'header Bearer hsk_ exploitable → fall-through
 *     vers le flow NextAuth normal (header absent, format non-hsk_, headers()
 *     throw en contexte statique).
 *   - `{ matched: true, scope: CanonicalScope }` : clé valide → scope service.
 *   - `{ matched: true, scope: null }` : clé matchée mais rejected (invalide,
 *     révoquée, ou sans user_id) → résolution Scope = null, PAS de fall-through
 *     pour éviter qu'une clé compromise puisse retomber sur la session cookie.
 *
 * Mode service : `userId = api_keys.user_id` (obligatoire, rejected si null),
 * `tenantId = api_keys.tenant_id`, `workspaceId = tenantId` (one-to-one en mode
 * backend-to-backend).
 */
async function resolveBearerScope(
  context: string,
): Promise<{ matched: false } | { matched: true; scope: CanonicalScope | null }> {
  let authHeader: string | null = null;
  try {
    const headersList = await headers();
    authHeader = headersList.get("authorization");
  } catch {
    return { matched: false };
  }

  if (!authHeader || !authHeader.startsWith("Bearer ")) return { matched: false };
  const rawKey = authHeader.substring(7).trim();
  if (!rawKey.startsWith(API_KEY_PREFIX)) return { matched: false };

  const verified = await verifyApiKey(rawKey);
  if (!verified) {
    console.warn(`[Scope] Bearer ${API_KEY_PREFIX} key invalid ou révoquée (${context})`);
    return { matched: true, scope: null };
  }

  if (!verified.userId) {
    console.warn(
      `[Scope] Bearer ${API_KEY_PREFIX} valide mais user_id null — rejected (${context}, tenant: ${redactId(verified.tenantId)})`,
    );
    return { matched: true, scope: null };
  }

  return {
    matched: true,
    scope: {
      userId: verified.userId,
      tenantId: verified.tenantId,
      workspaceId: verified.tenantId,
      isDevFallback: false,
    },
  };
}

/**
 * Resolve scope or return HTTP error response.
 * For use in API routes that need to return 401/403.
 */
export async function requireScope(
  options: ResolveScopeOptions = {},
): Promise<
  | { scope: CanonicalScope; error: null }
  | { scope: null; error: { message: string; status: number } }
> {
  const scope = await resolveScope(options);

  if (!scope) {
    return {
      scope: null,
      error: { message: "not_authenticated", status: 401 },
    };
  }

  return { scope, error: null };
}
