#!/usr/bin/env node
/**
 * Migrate Missions to Personal Tenant
 * 
 * Migre toutes les missions de l'utilisateur dev depuis "dev-tenant"
 * vers son tenant personnel en mettant à jour le champ actions.tenantId
 * dans la DB.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEV_USER_ID = "36914162-75f9-4c27-b38b-bb050f51d52b";
const PERSONAL_TENANT = "d10c9c22-2432-4daa-b4f2-ab849a87dfae";
const PERSONAL_WORKSPACE = "d10c9c22-2432-4daa-b4f2-ab849a87dfae";

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  console.log("🔄 Migrating missions to personal tenant...\n");

  // 1. Récupérer toutes les missions de l'user
  const { data: missions, error: fetchError } = await supabase
    .from("missions")
    .select("id, user_id, title, status, actions, created_at")
    .eq("user_id", DEV_USER_ID)
    .order("created_at", { ascending: false });

  if (fetchError) {
    console.error("❌ Failed to fetch missions:", fetchError.message);
    process.exit(1);
  }

  if (!missions || missions.length === 0) {
    console.log("✅ No missions to migrate.\n");
    return;
  }

  // 2. Filtrer celles dans dev-tenant
  const toMigrate = missions.filter((m) => {
    const actions = m.actions || {};
    return actions.tenantId === "dev-tenant";
  });

  if (toMigrate.length === 0) {
    console.log("✅ No missions in dev-tenant to migrate.\n");
    return;
  }

  console.log(`📦 Found ${toMigrate.length} mission(s) in dev-tenant:\n`);
  toMigrate.forEach((m) => {
    const actions = m.actions || {};
    console.log(`   - ${m.title} (${actions.schedule || "manual"})`);
  });
  console.log();

  // 3. Confirmer la migration
  console.log(`🔄 Migrating to personal tenant: ${PERSONAL_TENANT}\n`);

  let migrated = 0;
  let failed = 0;

  for (const mission of toMigrate) {
    const actions = mission.actions || {};
    
    // Update tenantId and workspaceId in actions JSONB
    const updatedActions = {
      ...actions,
      tenantId: PERSONAL_TENANT,
      workspaceId: PERSONAL_WORKSPACE,
    };

    const { error } = await supabase
      .from("missions")
      .update({ actions: updatedActions })
      .eq("id", mission.id);

    if (error) {
      console.error(`   ❌ Failed to migrate ${mission.title}: ${error.message}`);
      failed++;
    } else {
      console.log(`   ✅ Migrated: ${mission.title}`);
      migrated++;
    }
  }

  console.log(`\n📊 Migration complete:`);
  console.log(`   ✅ Migrated: ${migrated}`);
  if (failed > 0) {
    console.log(`   ❌ Failed: ${failed}`);
  }
  console.log();
  console.log(`🔄 Refresh your dashboard to see all your missions.\n`);
}

main().catch((err) => {
  console.error("❌ Unexpected error:", err);
  process.exit(1);
});
