#!/usr/bin/env node
/**
 * Purge user_tokens rows whose encrypted columns don't match
 * the current envelope format `keyId.iv.tag.ciphertext` (4 base64url parts)
 * nor the legacy `iv:tag:enc` (3 hex parts).
 *
 * Usage : node scripts/purge-malformed-tokens.mjs [--dry-run]
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const DRY = process.argv.includes("--dry-run");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function isWellFormed(ct) {
  if (!ct || typeof ct !== "string") return true; // null is fine
  // legacy hex format iv:tag:enc
  if (ct.includes(":") && ct.split(":").length === 3) return true;
  // new envelope keyId.iv.tag.ct
  if (ct.split(".").length === 4) return true;
  return false;
}

const { data, error } = await sb
  .from("user_tokens")
  .select("user_id, provider, access_token_enc, refresh_token_enc");

if (error) {
  console.error("Supabase select error:", error.message);
  process.exit(1);
}

const malformed = (data ?? []).filter(
  (r) => !isWellFormed(r.access_token_enc) || !isWellFormed(r.refresh_token_enc),
);

if (malformed.length === 0) {
  console.log(`OK — no malformed tokens (scanned ${data?.length ?? 0} rows).`);
  process.exit(0);
}

console.log(`Found ${malformed.length} malformed row(s):`);
for (const r of malformed) {
  console.log(
    `  - user=${r.user_id} provider=${r.provider} access_len=${r.access_token_enc?.length ?? 0} refresh_len=${r.refresh_token_enc?.length ?? 0}`,
  );
}

if (DRY) {
  console.log("\n[dry-run] no deletion performed. Re-run without --dry-run to purge.");
  process.exit(0);
}

for (const r of malformed) {
  const { error: delErr } = await sb
    .from("user_tokens")
    .delete()
    .eq("user_id", r.user_id)
    .eq("provider", r.provider);
  if (delErr) {
    console.error(`  FAIL ${r.user_id}/${r.provider}: ${delErr.message}`);
  } else {
    console.log(`  purged ${r.user_id}/${r.provider}`);
  }
}

console.log("\nDone. Reconnect the provider via the UI to get fresh tokens.");
