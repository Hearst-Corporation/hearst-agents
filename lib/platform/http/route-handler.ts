import type { SupabaseClient } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { isError as isAdminError, requireAdmin } from "@/app/api/admin/_helpers";
import type { PermissionCheck } from "@/lib/admin/permissions";
import { type CanonicalScope, requireScope } from "@/lib/platform/auth/scope";

/**
 * Context passed to a scoped route handler.
 *
 * `scope` is guaranteed non-null (auth check passed). `params` is the
 * resolved Next.js 15 dynamic segments (await'd by the wrapper).
 */
export interface ScopedContext<TParams = undefined> {
  scope: CanonicalScope;
  params: TParams;
}

/**
 * Context passed to an admin route handler. Same as ScopedContext + the
 * Supabase client returned by the permission guard.
 */
export interface AdminContext<TParams = undefined> {
  scope: CanonicalScope;
  db: SupabaseClient;
  params: TParams;
}

export type ScopedRouteHandler<TParams = undefined> = (
  req: NextRequest,
  ctx: ScopedContext<TParams>,
) => Promise<NextResponse | Response> | NextResponse | Response;

export type AdminRouteHandler<TParams = undefined> = (
  req: NextRequest,
  ctx: AdminContext<TParams>,
) => Promise<NextResponse | Response> | NextResponse | Response;

/**
 * Next.js 15 route handler shape — `params` is now a Promise.
 *
 * Next.js itself always invokes route handlers with `{ params: Promise<{}> }`
 * (even for routes without dynamic segments). We keep the param optional so
 * unit tests can call the handler with a single arg (`await GET(req)`).
 */
type NextRouteContext<TParams> = { params: Promise<TParams> } | undefined;

/**
 * HOF wrapping the `requireScope + early-return` pattern repeated on 90+
 * routes (AUDIT-2 DUP14).
 *
 * Usage (no dynamic segment):
 *   export const GET = withScope("GET /api/foo", async (req, { scope }) => {
 *     return NextResponse.json({ tenantId: scope.tenantId });
 *   });
 *
 * Usage (dynamic segment):
 *   export const GET = withScope<{ id: string }>(
 *     "GET /api/foo/[id]",
 *     async (req, { scope, params }) => {
 *       return NextResponse.json({ id: params.id, tenantId: scope.tenantId });
 *     },
 *   );
 *
 * On scope failure → `NextResponse.json({ error }, { status })` is returned
 * using the canonical shape `{ error: <message> }` (matches the dominant
 * pattern across existing routes).
 */
export function withScope<TParams = Record<string, never>>(
  context: string,
  handler: ScopedRouteHandler<TParams>,
): (req: NextRequest, routeCtx?: NextRouteContext<TParams>) => Promise<NextResponse | Response> {
  return async (req, routeCtx) => {
    const { scope, error } = await requireScope({ context });
    if (error || !scope) {
      return NextResponse.json(
        { error: error?.message ?? "not_authenticated" },
        { status: error?.status ?? 401 },
      );
    }

    const params = ((await routeCtx?.params) ?? ({} as TParams)) as TParams;
    return handler(req, { scope, params });
  };
}

/**
 * HOF wrapping the `requireAdmin + isError` guard repeated on dozens of admin
 * routes. Combines auth + permission check + Supabase client wiring.
 *
 * Usage:
 *   export const GET = withAdmin(
 *     "GET /api/admin/foo",
 *     { resource: "settings", action: "read" },
 *     async (req, { db, scope }) => {
 *       const { data } = await db.from("things").select("*");
 *       return NextResponse.json({ data });
 *     },
 *   );
 *
 * Dynamic segments work the same as withScope:
 *   export const GET = withAdmin<{ runId: string }>(
 *     "GET /api/admin/runs/[runId]/events",
 *     { resource: "runs", action: "read" },
 *     async (req, { db, params }) => { ... },
 *   );
 */
export function withAdmin<TParams = Record<string, never>>(
  context: string,
  permission: Omit<PermissionCheck, "userId" | "tenantId">,
  handler: AdminRouteHandler<TParams>,
): (req: NextRequest, routeCtx?: NextRouteContext<TParams>) => Promise<NextResponse | Response> {
  return async (req, routeCtx) => {
    const guard = await requireAdmin(context, permission);
    if (isAdminError(guard)) return guard;

    const params = ((await routeCtx?.params) ?? ({} as TParams)) as TParams;
    return handler(req, {
      scope: guard.scope,
      db: guard.db,
      params,
    });
  };
}
