#!/usr/bin/env node
/**
 * Check Missions Scope — Debug where missions are stored
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEV_USER_ID = "36914162-75f9-4c27-b38b-bb050f51d52b";
const PERSONAL_TENANT = "d10c9c22-2432-4daa-b4f2-ab849a87dfae";

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  console.log("🔍 Checking missions distribution...\n");

  // Toutes les missions de l'user
  const { data: userMissions, error: userError } = await supabase
    .from("missions")
    .select("id, user_id, title, status, actions, created_at")
    .eq("user_id", DEV_USER_ID)
    .order("created_at", { ascending: false })
    .limit(20);

  console.log(`👤 Missions by user ${DEV_USER_ID.slice(0, 8)}:`);
  if (userError) {
    console.error("   Error:", userError.message);
    process.exit(1);
  }
  
  if (!userMissions || userMissions.length === 0) {
    console.log("   ❌ No missions found\n");
    return;
  }

  console.log(`   ✅ ${userMissions.length} mission(s):\n`);

  const byTenant = new Map();
  userMissions.forEach((m) => {
    const actions = m.actions || {};
    const tenant = actions.tenantId || "null";
    if (!byTenant.has(tenant)) byTenant.set(tenant, []);
    byTenant.get(tenant).push(m);
  });

  byTenant.forEach((missions, tenant) => {
    const isPersonal = tenant === PERSONAL_TENANT;
    const label = isPersonal ? "📦 Personal tenant" : tenant === "null" ? "❓ No tenant" : tenant === "dev-tenant" ? "🔓 Shared dev-tenant" : `📦 Tenant: ${tenant}`;
    console.log(`   ${label} (${missions.length} missions):`);
    missions.forEach((m) => {
      const actions = m.actions || {};
      console.log(`      - ${m.title} (${m.status}) [${actions.schedule || "manual"}]`);
    });
    console.log();
  });

  const personalCount = byTenant.get(PERSONAL_TENANT)?.length || 0;
  const devTenantCount = byTenant.get("dev-tenant")?.length || 0;

  if (devTenantCount > 0) {
    console.log(`💡 You have ${devTenantCount} mission(s) in the shared "dev-tenant".`);
    console.log(`   These won't appear in your personal scope.\n`);
    console.log(`   To migrate them, update their tenantId in the actions JSONB.`);
    console.log(`   (Migration script available if needed)\n`);
  }

  if (personalCount === 0) {
    console.log(`💡 Your personal tenant (${PERSONAL_TENANT}) has no missions yet.`);
    console.log(`   Create a new mission from the dashboard to test the isolated scope.\n`);
  }
}

main().catch((err) => {
  console.error("❌ Unexpected error:", err);
  process.exit(1);
});
