import type { AuthOptions } from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { registerProviderUsage } from "@/lib/connectors/control-plane/register";
import { logger } from "@/lib/observability/logger";
import { saveTokens } from "@/lib/platform/auth/tokens";
import { getServerSupabase } from "@/lib/platform/db/supabase";
import { redactId } from "@/lib/utils/redact";
import { resolveOrCreateUserUuid } from "./user-resolver";

const DEV_BYPASS = process.env.HEARST_DEV_AUTH_BYPASS === "1";
const DEV_USER_UUID = "36914162-75f9-4c27-b38b-bb050f51d52b";

export const authOptions: AuthOptions = {
  pages: {
    signIn: "/login",
  },
  providers: [
    // ── Dev bypass provider (HEARST_DEV_AUTH_BYPASS=1 uniquement) ──────────
    // Crée une vraie session JWT sans OAuth pour le dev/Electron local.
    // Désactivé automatiquement en prod (DEV_BYPASS=false).
    ...(DEV_BYPASS
      ? [
          CredentialsProvider({
            id: "dev-bypass",
            name: "Dev Bypass",
            credentials: {},
            async authorize() {
              return {
                id: DEV_USER_UUID,
                name: "Adrien (dev)",
                email: "adriennejkovic@gmail.com",
              };
            },
          }),
        ]
      : []),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          // Le bouton "Continuer avec Google" est l'unique point d'entrée :
          // un seul consent demande à la fois l'identité ET les scopes
          // read+write Gmail / Calendar / Drive. La pipeline IA peut alors
          // appeler les tools natifs sans 2e popup.
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/gmail.modify",
            "https://www.googleapis.com/auth/gmail.send",
            "https://www.googleapis.com/auth/calendar.events",
            "https://www.googleapis.com/auth/drive.file",
          ].join(" "),
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID ?? "",
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET ?? "",
      tenantId: process.env.AZURE_AD_TENANT_ID ?? "common",
      authorization: {
        params: {
          // Idem côté Microsoft : identité + read+write Mail / Calendars /
          // Files au premier consent.
          scope:
            "openid email profile offline_access Mail.ReadWrite Mail.Send Calendars.ReadWrite Files.ReadWrite",
        },
      },
    }),
  ],
  callbacks: {
    // Mod 1.A — Domain allowlist : empêche l'enrôlement d'email hors périmètre.
    // En prod : HEARST_ALLOWED_EMAIL_DOMAINS requis (CSV de domaines autorisés).
    // En dev : pass-through si var absente pour faciliter les tests locaux.
    async signIn({ user, account, profile }) {
      // Dev bypass NextAuth provider — toujours autorisé
      if (account?.provider === "dev-bypass") return true;

      const email = (profile as { email?: string } | undefined)?.email ?? user?.email ?? null;
      if (!email) {
        console.warn(`[Auth] signIn rejected: no email (provider=${account?.provider})`);
        return false;
      }

      const allowed = (process.env.HEARST_ALLOWED_EMAIL_DOMAINS ?? "")
        .split(",")
        .map((d) => d.trim().toLowerCase())
        .filter(Boolean);

      // En prod : allowlist obligatoire. En dev : pass-through si vide.
      if (process.env.NODE_ENV === "production" && allowed.length === 0) {
        console.error(
          "[Auth] HEARST_ALLOWED_EMAIL_DOMAINS not set in production — rejecting all signins",
        );
        return false;
      }
      if (allowed.length === 0) return true; // dev only

      const domain = email.split("@")[1]?.toLowerCase() ?? "";
      if (!allowed.includes(domain)) {
        console.warn(
          `[Auth] signIn rejected: domain ${domain} not in allowlist (email=${email}, provider=${account?.provider})`,
        );
        return false;
      }
      return true;
    },
    async jwt({ token, account, profile, user }) {
      // Dev bypass : injecter l'userId depuis le user object + charger tenant
      if (account?.provider === "dev-bypass" && user) {
        token.userId = user.id;
        token.email = user.email ?? undefined;
        // Charger primary_tenant_id depuis DB (backfill migration 0070 garantit
        // que le user dev a un tenant_id valide en DB)
        const sb = getServerSupabase();
        if (sb && user.id) {
          const { data } = await sb
            .from("users")
            .select("primary_tenant_id, primary_workspace_id")
            .eq("id", user.id)
            .single();
          if (data) {
            token.tenantId = data.primary_tenant_id ?? undefined;
            token.workspaceId = data.primary_workspace_id ?? undefined;
            logger.info(
              { userId: redactId(user.id), tenantId: redactId(data.primary_tenant_id) },
              "[Auth] Dev-bypass JWT created",
            );
          } else {
            console.warn(`[Auth] Dev-bypass JWT — no tenant found for user ${redactId(user.id)}`);
          }
        }
        return token;
      }
      if (account && profile) {
        const email = (profile as { email?: string }).email ?? null;
        const providerName = account.provider === "azure-ad" ? "microsoft" : "google";

        // Résolution canonique de l'identifiant utilisateur :
        // public.users.id (UUID) via lookup par email, auto-provisioning
        // si l'utilisateur n'existe pas encore (premier login).
        // Avant ce fix, token.userId = profile.email — ce qui faisait
        // remonter un email comme identifiant dans toutes les écritures
        // DB (cf. cleanup migration 0026_user_identity_uuid_cleanup.sql).
        const uuid = email
          ? await resolveOrCreateUserUuid(email).catch((err) => {
              console.error("[Auth] resolveOrCreateUserUuid failed:", err);
              return null;
            })
          : null;

        // Fallback strict : si la résolution échoue (DB indispo, email absent),
        // on ne fabrique PAS d'identifiant artificiel. Le user n'aura pas
        // d'userId valide → resolveScope() retournera null → 401 sur les
        // routes auth-required. Préférable à un email silencieux qui pollue.
        if (!uuid) {
          console.warn(
            `[Auth] Unable to resolve UUID for email=${email ?? "<none>"}, provider=${providerName}`,
          );
        }

        // Mod 1.B — Charge primary_tenant_id/primary_workspace_id depuis la DB
        // (source de vérité). Stocké dans le JWT pour hydrater scope sans DB
        // supplémentaire à chaque requête.
        let primaryTenantId: string | undefined;
        let primaryWorkspaceId: string | undefined;
        if (uuid) {
          const sb = getServerSupabase();
          if (sb) {
            const { data, error } = await sb
              .from("users")
              .select("primary_tenant_id, primary_workspace_id")
              .eq("id", uuid)
              .single();
            if (!error && data) {
              primaryTenantId = data.primary_tenant_id ?? undefined;
              primaryWorkspaceId = data.primary_workspace_id ?? undefined;
            } else if (error) {
              console.error(
                `[Auth] Failed to load tenant for user ${redactId(uuid)}: ${error.message}`,
              );
            }
          }
        }

        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at ?? 0;
        token.userId = uuid ?? undefined;
        token.tenantId = primaryTenantId;
        token.workspaceId = primaryWorkspaceId;
        if (email) token.email = email;
        // Prénom / nom de l'utilisateur — Google expose `given_name`, Azure `name`.
        // Stocké dans token.name pour être exposé via session.user.name (NextAuth).
        token.name =
          (profile as { given_name?: string; name?: string } | undefined)?.given_name ??
          (profile as { name?: string } | undefined)?.name ??
          user?.name ??
          undefined;

        if (uuid) {
          await saveTokens(
            uuid,
            {
              accessToken: account.access_token ?? null,
              refreshToken: account.refresh_token ?? null,
              expiresAt: account.expires_at ?? 0,
            },
            providerName,
          );

          // Mod 1.D — tenant chargé depuis la DB, plus depuis process.env
          const tenantId = primaryTenantId;
          const workspaceId = primaryWorkspaceId;
          if (!tenantId || !workspaceId) {
            console.error(
              `[Auth] No primary_tenant for user ${redactId(uuid)} — registerProviderUsage skipped`,
            );
          } else {
            void registerProviderUsage({
              provider: providerName as "google",
              scope: { tenantId, workspaceId, userId: uuid },
            });
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      const s = session as unknown as Record<string, unknown>;
      s.accessToken = token.accessToken;
      s.userId = token.userId;
      // Mod 1.C — tenantId + workspaceId exposés top-level sur la session
      // (chargés depuis DB lors du jwt callback, pas depuis process.env).
      s.tenantId = token.tenantId;
      s.workspaceId = token.workspaceId;
      // Expose user.id (UUID) en plus de user.email pour que le frontend
      // ait accès à l'identifiant canonique sans transiter par un appel
      // serveur. À utiliser comme identifiant dans tout React state qui
      // a besoin d'une key user.
      if (session.user && typeof token.userId === "string") {
        const u = session.user as {
          id?: string;
          tenantId?: string;
          workspaceId?: string;
          name?: string | null;
        };
        u.id = token.userId;
        u.tenantId = token.tenantId;
        u.workspaceId = token.workspaceId;
        // Peuple session.user.name depuis token.name (NextAuth ne le fait pas
        // automatiquement quand on utilise un custom jwt callback).
        if (token.name) u.name = token.name as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
