/**
 * Helm → Cortex auth bridge.
 * Génère un JWT court (15 min) pour un user Supabase, signé avec JWT_SECRET partagé.
 * Le JWT_SECRET doit être identique à celui de Cortex (.env.local côté Cortex).
 *
 * Mapping :
 *   - Supabase user.id → tenant_id Cortex
 *   - Email Adrien + 2 partenaires (env ADMIN_EMAILS) → scope = ["read","write","admin"]
 *   - Tout autre user → scope = ["read","write"]
 */

import { SignJWT } from "jose";

const JWT_SECRET = process.env.CORTEX_JWT_SECRET;
const JWT_ISS = "cortex";
const JWT_AUD = "cortex.hearst.app";

const ADMIN_EMAILS = (process.env.CORTEX_ADMIN_EMAILS ?? "adrien@beyondcrypto.com")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export interface CortexTokenInput {
  user_id: string;
  email?: string;
  tenant_id?: string;
  ttl_seconds?: number;
}

export async function signCortexToken(input: CortexTokenInput): Promise<string | null> {
  if (!JWT_SECRET || JWT_SECRET.length < 32) {
    console.warn("[cortex-jwt] CORTEX_JWT_SECRET missing or too short");
    return null;
  }

  const isAdmin = input.email != null && ADMIN_EMAILS.includes(input.email.toLowerCase());
  const scope = isAdmin ? ["read", "write", "admin"] : ["read", "write"];
  const tenant_id = isAdmin ? "adrien" : (input.tenant_id ?? input.user_id);

  const secret = new TextEncoder().encode(JWT_SECRET);

  return await new SignJWT({
    sub: input.user_id,
    tenant_id,
    scope,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(JWT_ISS)
    .setAudience(JWT_AUD)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + (input.ttl_seconds ?? 900)) // 15 min default
    .sign(secret);
}
