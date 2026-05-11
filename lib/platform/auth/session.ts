/**
 * Platform Auth — Session Helpers
 *
 * Server-side session utilities for NextAuth.
 * Architecture Finale: lib/platform/auth/session.ts
 */

import { getServerSession } from "next-auth";
import { authOptions } from "./options";
import { isDevBypassEnabled } from "./dev-bypass";

// UUID Adrien dans public.users — cohérent avec lib/platform/auth/get-user-id.ts.
const DEV_USER = "36914162-75f9-4c27-b38b-bb050f51d52b";

export interface HearstSession {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  accessToken?: string;
  userId?: string;
}

/**
 * Get the current server-side session.
 * Returns null if the user is not authenticated.
 */
export async function getHearstSession(): Promise<HearstSession | null> {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  return session as unknown as HearstSession;
}

/**
 * Get the current user ID from the session.
 * En mode dev bypass (HEARST_DEV_AUTH_BYPASS=1), retourne le UUID dev fixe.
 */
export async function getCurrentUserId(): Promise<string | null> {
  if (isDevBypassEnabled()) {
    return DEV_USER;
  }

  const session = await getHearstSession();
  // Priorité 1 : session.userId (legacy top-level posé par jwt callback).
  const sessionUserId = (session as unknown as Record<string, unknown>)?.userId as string | null;
  // Priorité 2 : session.user.id (UUID exposé par le callback session()).
  const userIdFromUser = (session?.user as { id?: string } | undefined)?.id ?? null;
  // Pas de fallback email (F-015) : retourner null force un 401 côté caller.
  // Un fallback email créerait des orphan rows avec user_id=email qui échappent RLS uuid.
  return sessionUserId ?? userIdFromUser ?? null;
}

/**
 * Require authentication — throws if not authenticated.
 */
export async function requireAuth(): Promise<HearstSession> {
  const session = await getHearstSession();
  if (!session) {
    throw new Error("Authentication required");
  }
  return session;
}
