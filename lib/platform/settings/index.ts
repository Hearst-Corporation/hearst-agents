/**
 * Platform Settings — Public API
 *
 * Cached access to system settings with fallbacks.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getAllSettings } from "./store";
import type { SettingValue, SystemSetting } from "./types";

/**
 * Get all settings for a category.
 */
export async function getCategorySettings(
  db: SupabaseClient,
  category: SystemSetting["category"],
  tenantId?: string | null,
): Promise<Record<string, SettingValue>> {
  const settings = await getAllSettings(db, category, tenantId);
  return Object.fromEntries(settings.map((s) => [s.key, s.value]));
}

export { getSettingValue, invalidateSettingsCache, setSettingValue } from "./cache";
// Re-exports
export { getAllSettings, getSetting, setSetting } from "./store";
// System-level (feature flags, thresholds, limits)
export {
  getFeatureFlag,
  getLimit,
  getThreshold,
  seedDefaults,
  setFeatureFlag,
  setThreshold,
} from "./system";
// Tenant-scoped overrides
export {
  getAllTenantSettings,
  getTenantFeatureFlag,
  getTenantLimit,
  getTenantSetting,
  resetTenantSettings,
  setTenantFeatureFlag,
  setTenantSetting,
} from "./tenant";
export type { SettingCategory, SettingDefinition, SettingValue, SystemSetting } from "./types";
// User preferences
export {
  getUserLocale,
  getUserNotificationPrefs,
  getUserPreference,
  setUserPreference,
} from "./user";
