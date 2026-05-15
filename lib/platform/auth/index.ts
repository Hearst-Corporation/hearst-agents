/**
 * Platform Auth — Public API
 *
 * NextAuth configuration, token store, and session helpers.
 */

export {
  assertDevBypassNotInProduction,
  isDevBypassEnabled,
} from "./dev-bypass";
export { getUserId } from "./get-user-id";
export { authOptions } from "./options";
export {
  type CanonicalScope,
  requireScope,
  resolveScope,
} from "./scope";
export {
  getCurrentUserId,
  getHearstSession,
  type HearstSession,
  requireAuth,
} from "./session";
export {
  clearTokens,
  getTokenMeta,
  getTokens,
  isTokenExpired,
  type KeyProvider,
  recordAuthFailure,
  resetAuthFailures,
  revokeToken,
  type StoredTokens,
  saveTokens,
  setKeyProvider,
  type TokenMeta,
  touchLastUsed,
} from "./tokens";
