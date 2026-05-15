/**
 * Audit + repair des tokens OAuth corrompus dans `user_tokens` (Supabase prod).
 *
 * Détecte les tokens dont le format chiffré n'est plus parsable
 * ("Malformed encrypted token") et propose de les marquer `revoked_at = now()`.
 *
 * Usage :
 *   - Audit (read-only)        : npx tsx scripts/audit-broken-tokens.ts
 *   - Apply (soft revoke)      : npx tsx scripts/audit-broken-tokens.ts --apply
 *
 * Aucun DELETE — uniquement `revoked_at = now()`. Réversible via SQL si erreur.
 */

import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const KEY_PROVIDERS: Record<string, () => Buffer> = {
  "1": () => {
    const hex = process.env.TOKEN_ENCRYPTION_KEY_1 ?? process.env.TOKEN_ENCRYPTION_KEY;
    if (!hex || hex.length !== 64) {
      throw new Error("TOKEN_ENCRYPTION_KEY_1 (or TOKEN_ENCRYPTION_KEY) must be 64-char hex");
    }
    return Buffer.from(hex, "hex");
  },
  "2": () => {
    const hex = process.env.TOKEN_ENCRYPTION_KEY_2;
    if (!hex || hex.length !== 64) {
      throw new Error("TOKEN_ENCRYPTION_KEY_2 must be 64-char hex");
    }
    return Buffer.from(hex, "hex");
  },
};

const ALGORITHM = "aes-256-gcm";

function tryDecrypt(ciphertext: string): { ok: true } | { ok: false; reason: string } {
  if (!ciphertext) return { ok: false, reason: "empty" };

  const parts = ciphertext.split(".");

  // Legacy format `iv:tag:enc`
  if (parts.length === 3 && ciphertext.includes(":")) {
    try {
      const [ivHex, authTagHex, encHex] = ciphertext.split(":");
      if (!ivHex || !authTagHex || !encHex) {
        return { ok: false, reason: "legacy: missing parts" };
      }
      const keyFn = KEY_PROVIDERS["1"];
      const key = keyFn();
      const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
      decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
      Buffer.concat([decipher.update(Buffer.from(encHex, "hex")), decipher.final()]);
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        reason: `legacy decrypt error: ${err instanceof Error ? err.message : "unknown"}`,
      };
    }
  }

  // New format `keyId.iv.tag.ciphertext`
  if (parts.length !== 4) {
    return { ok: false, reason: `expected 4 parts, got ${parts.length}` };
  }

  const [keyId, ivB64, tagB64, ctB64] = parts;
  if (!keyId || !ivB64 || !tagB64 || !ctB64) {
    return { ok: false, reason: "new format: missing parts" };
  }

  const keyFn = KEY_PROVIDERS[keyId];
  if (!keyFn) {
    return { ok: false, reason: `unknown keyId "${keyId}"` };
  }

  try {
    const key = keyFn();
    if (key.length !== 32) {
      return { ok: false, reason: `key ${keyId} has invalid length ${key.length}` };
    }
    const iv = Buffer.from(ivB64, "base64url");
    const tag = Buffer.from(tagB64, "base64url");
    const ct = Buffer.from(ctB64, "base64url");
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    Buffer.concat([decipher.update(ct), decipher.final()]);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: `decrypt error: ${err instanceof Error ? err.message : "unknown"}`,
    };
  }
}

interface UserTokenRow {
  user_id: string;
  provider: string;
  access_token_enc: string | null;
  refresh_token_enc: string | null;
  revoked_at: string | null;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const sb = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`\n📡 Connexion à ${SUPABASE_URL}\n`);

  const { data, error } = await sb
    .from("user_tokens")
    .select("user_id, provider, access_token_enc, refresh_token_enc, revoked_at")
    .is("revoked_at", null);

  if (error) {
    console.error("❌ Erreur lecture user_tokens:", error);
    process.exit(1);
  }

  const rows = (data ?? []) as UserTokenRow[];
  console.log(`Lecture: ${rows.length} rows actives (revoked_at IS NULL)\n`);

  const broken: Array<{ user_id: string; provider: string; reasons: string[] }> = [];

  for (const row of rows) {
    const reasons: string[] = [];

    if (row.access_token_enc) {
      const res = tryDecrypt(row.access_token_enc);
      if (!res.ok) reasons.push(`access_token: ${res.reason}`);
    }

    if (row.refresh_token_enc) {
      const res = tryDecrypt(row.refresh_token_enc);
      if (!res.ok) reasons.push(`refresh_token: ${res.reason}`);
    }

    if (reasons.length > 0) {
      broken.push({ user_id: row.user_id, provider: row.provider, reasons });
    }
  }

  if (broken.length === 0) {
    console.log("✅ Aucun token corrompu détecté.\n");
    return;
  }

  console.log(`⚠️  ${broken.length} row(s) avec tokens corrompus:\n`);
  for (const b of broken) {
    console.log(`  - user=${b.user_id} provider=${b.provider}`);
    for (const r of b.reasons) console.log(`      · ${r}`);
  }

  if (!apply) {
    console.log("\n🔍 Mode AUDIT (read-only).");
    console.log("Pour soft-revoker ces tokens (revoked_at = now()), relance avec --apply\n");
    return;
  }

  console.log("\n⚙️  Mode APPLY — marquage revoked_at = now() pour les rows ci-dessus...\n");

  let updated = 0;
  for (const b of broken) {
    const { error: updErr } = await sb
      .from("user_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("user_id", b.user_id)
      .eq("provider", b.provider);

    if (updErr) {
      console.error(`  ❌ user=${b.user_id} provider=${b.provider}: ${updErr.message}`);
    } else {
      console.log(`  ✅ user=${b.user_id} provider=${b.provider} → revoked`);
      updated++;
    }
  }

  console.log(`\n✅ Terminé. ${updated}/${broken.length} rows revoquées.`);
  console.log(
    "Réversible via SQL :  UPDATE user_tokens SET revoked_at = NULL WHERE user_id = ... AND provider = ...;\n",
  );
}

main().catch((err) => {
  console.error("❌ Fatal:", err);
  process.exit(1);
});
