#!/usr/bin/env node
/**
 * Setup Personal Scope — Configure tenant/workspace for dev user
 * 
 * Crée un tenant et workspace personnels pour l'utilisateur de dev,
 * met à jour public.users.primary_tenant_id/primary_workspace_id,
 * et génère les env vars à ajouter dans .env.local.
 */

import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEV_USER_ID = "36914162-75f9-4c27-b38b-bb050f51d52b";

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  console.log("🔍 Checking current user scope...\n");

  // 1. Récupérer l'utilisateur actuel
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, email, primary_tenant_id, primary_workspace_id")
    .eq("id", DEV_USER_ID)
    .single();

  if (userError || !user) {
    console.error("❌ User not found:", userError?.message);
    process.exit(1);
  }

  console.log(`📧 User: ${user.email}`);
  console.log(`🆔 User ID: ${user.id}\n`);

  // 2. Vérifier si déjà configuré
  if (user.primary_tenant_id && user.primary_workspace_id) {
    console.log(`✅ Already configured:`);
    console.log(`   Tenant: ${user.primary_tenant_id}`);
    console.log(`   Workspace: ${user.primary_workspace_id}\n`);
    
    console.log(`Add to .env.local:\n`);
    console.log(`HEARST_TENANT_ID=${user.primary_tenant_id}`);
    console.log(`HEARST_WORKSPACE_ID=${user.primary_workspace_id}\n`);
    return;
  }

  // 3. Créer tenant personnel
  const tenantId = `tenant-${randomBytes(8).toString("hex")}`;
  const tenantName = user.email.split("@")[0] || "dev";

  console.log(`🏗️  Creating personal tenant: ${tenantId}...`);

  const { error: tenantError } = await supabase
    .from("tenants")
    .insert({
      id: tenantId,
      name: `${tenantName}'s Workspace`,
      slug: tenantName.toLowerCase().replace(/[^a-z0-9]/g, "-"),
      owner_id: user.id,
    });

  if (tenantError) {
    console.error("❌ Failed to create tenant:", tenantError.message);
    process.exit(1);
  }

  // 4. Créer workspace personnel
  const workspaceId = `workspace-${randomBytes(8).toString("hex")}`;

  console.log(`🏗️  Creating personal workspace: ${workspaceId}...`);

  const { error: workspaceError } = await supabase
    .from("workspaces")
    .insert({
      id: workspaceId,
      name: "Personal Workspace",
      slug: "personal",
      tenant_id: tenantId,
      owner_id: user.id,
    });

  if (workspaceError) {
    console.error("❌ Failed to create workspace:", workspaceError.message);
    process.exit(1);
  }

  // 5. Mettre à jour l'utilisateur
  console.log(`🔗 Linking tenant and workspace to user...`);

  const { error: updateError } = await supabase
    .from("users")
    .update({
      primary_tenant_id: tenantId,
      primary_workspace_id: workspaceId,
    })
    .eq("id", user.id);

  if (updateError) {
    console.error("❌ Failed to update user:", updateError.message);
    process.exit(1);
  }

  // 6. Afficher les résultats
  console.log(`\n✅ Personal scope created successfully!\n`);
  console.log(`📋 Add these to your .env.local:\n`);
  console.log(`HEARST_TENANT_ID=${tenantId}`);
  console.log(`HEARST_WORKSPACE_ID=${workspaceId}\n`);
  console.log(`🔄 After adding, restart your dev server.\n`);
}

main().catch((err) => {
  console.error("❌ Unexpected error:", err);
  process.exit(1);
});
