/**
 * Platform Settings — Public API
 *
 * Cached access to system settings with fallbacks.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SystemSetting, SettingValue } from "./types";
import { getSetting, setSetting, getAllSettings } from "./store";
import { getSettingValue, setSettingValue, invalidateSettingsCache } from "./cache";

/**
 * Get all settings for a category.
 */
export async function getCategorySettings(
  db: SupabaseClient,
  category: SystemSetting["category"],
  tenantId?: string | null
): Promise<Record<string, SettingValue>> {
  const settings = await getAllSettings(db, category, tenantId);
  return Object.fromEntries(settings.map((s) => [s.key, s.value]));
}

// Re-exports
export { getSetting, setSetting, getAllSettings } from "./store";
export { getSettingValue, setSettingValue, invalidateSettingsCache } from "./cache";
export type { SystemSetting, SettingValue, SettingCategory, SettingDefinition } from "./types";

// System-level (feature flags, thresholds, limits)
export {
  getFeatureFlag,
  setFeatureFlag,
  getThreshold,
  setThreshold,
  getLimit,
  seedDefaults,
} from "./system";

// User preferences
export {
  getUserPreference,
  setUserPreference,
  getUserLocale,
  getUserNotificationPrefs,
} from "./user";

// Tenant-scoped overrides
export {
  getTenantSetting,
  setTenantSetting,
  getAllTenantSettings,
  getTenantFeatureFlag,
  setTenantFeatureFlag,
  getTenantLimit,
  resetTenantSettings,
} from "./tenant";
