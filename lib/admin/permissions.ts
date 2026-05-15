/**
 * Admin Permissions API — Architecture Finale
 *
 * RBAC (Role-Based Access Control) logic.
 * Path: lib/admin/permissions.ts
 *
 * Role hierarchy (highest to lowest):
 * - admin: Full access
 * - editor: Can create/modify, limited delete
 * - viewer: Read-only access
 * - guest: Minimal access, no sensitive data
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type Role = "admin" | "editor" | "viewer" | "guest";

export interface PermissionCheck {
  userId: string;
  resource: string;
  action: "create" | "read" | "update" | "delete" | "admin";
  tenantId?: string;
  resourceOwnerId?: string;
}

// Permission matrix: role -> resource -> actions
const PERMISSION_MATRIX: Record<Role, Record<string, string[]>> = {
  admin: {
    "*": ["create", "read", "update", "delete", "admin"],
  },
  editor: {
    settings: ["read", "update"],
    connectors: ["read", "create", "update"],
    runs: ["read", "create", "update"],
    assets: ["read", "create", "update"],
    users: ["read"],
    "*": ["read"],
  },
  viewer: {
    settings: ["read"],
    connectors: ["read"],
    runs: ["read"],
    assets: ["read"],
    users: ["read"],
    "*": ["read"],
  },
  guest: {
    runs: ["read"],
    assets: ["read"],
  },
};

/**
 * Check if a user has permission for an action on a resource
 */
export async function checkPermission(
  db: SupabaseClient,
  check: PermissionCheck,
): Promise<boolean> {
  const role = await getUserRole(db, check.userId, check.tenantId);
  return hasPermission(role, check.resource, check.action);
}

/**
 * Check permission synchronously (when role is already known)
 */
function hasPermission(role: Role, resource: string, action: PermissionCheck["action"]): boolean {
  // Admin has all permissions
  if (role === "admin") return true;

  const rolePerms = PERMISSION_MATRIX[role];
  if (!rolePerms) return false;

  // Check specific resource permissions
  const specificPerms = rolePerms[resource];
  if (specificPerms?.includes(action) || specificPerms?.includes("*")) {
    return true;
  }

  // Check wildcard permissions
  const wildcardPerms = rolePerms["*"];
  if (wildcardPerms?.includes(action) || wildcardPerms?.includes("*")) {
    return true;
  }

  return false;
}

/**
 * Get user's role (from JWT or database)
 */
export async function getUserRole(
  db: SupabaseClient,
  userId: string,
  tenantId?: string,
): Promise<Role> {
  // First check tenant-specific role assignment
  if (tenantId) {
    const { data, error } = await db
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("tenant_id", tenantId)
      .single();

    if (!error && data) {
      return data.role as Role;
    }
  }

  // Fall back to global role from user metadata
  const { data: user, error } = await db.auth.admin.getUserById(userId);

  if (error || !user) {
    console.warn("[Admin/Permissions] Could not fetch user, defaulting to guest:", error);
    return "guest";
  }

  const role = user.user?.user_metadata?.role as Role;
  return role || "guest";
}
