/**
 * Module augmentation NextAuth — champs custom injectés par le callback jwt().
 *
 * tenantId + workspaceId : chargés depuis public.users.primary_tenant_id
 * à chaque refresh JWT (DB source of truth). Voir lib/platform/auth/options.ts.
 */
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    userId?: string;
    tenantId?: string;
    workspaceId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    userId?: string;
    email?: string;
    tenantId?: string;
    workspaceId?: string;
  }
}
