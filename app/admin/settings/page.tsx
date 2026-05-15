import { getFeatureFlags, getSystemSettings } from "@/lib/admin/settings";
import { getServerSupabase } from "@/lib/platform/db/supabase";
import type { SystemSetting } from "@/lib/platform/settings/types";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const sb = getServerSupabase();
  let settings: SystemSetting[] = [];
  let flags: Record<string, boolean> = {};
  let dbError: string | null = null;

  if (sb) {
    try {
      [settings, flags] = await Promise.all([getSystemSettings(sb), getFeatureFlags(sb)]);
    } catch (e) {
      dbError = e instanceof Error ? e.message : "Unknown error";
    }
  } else {
    dbError = "Supabase not configured";
  }

  const categories = [...new Set(settings.map((s) => s.category))].sort();

  return (
    <div className="p-(--space-8) space-y-(--space-8) text-text-soft h-full overflow-y-auto">
      <div className="flex items-center justify-between">
        <h1 className="t-24 font-light text-text">Réglages système</h1>
        <span className="t-11 text-text-ghost font-mono">{settings.length} entrées</span>
      </div>

      {dbError && (
        <div className="rounded-(--radius-md) bg-(--danger)/10 border border-(--danger)/25 p-(--space-4) text-(--danger) t-13">
          {dbError}
        </div>
      )}

      {/* Feature Flags */}
      <section>
        <h2 className="t-10 font-mono uppercase tracking-(--tracking-stretch) text-text-faint mb-(--space-4)">
          Feature Flags
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-(--space-3)">
          {Object.entries(flags).map(([key, enabled]) => (
            <div
              key={key}
              className="rounded-(--radius-md) bg-(--card-flat-bg) border border-(--card-flat-border) p-(--space-3) flex items-center justify-between"
            >
              <span className="t-12 text-text-muted truncate mr-(--space-2)">{key}</span>
              <span
                className={`t-9 font-mono px-(--space-2) rounded-pill ${
                  enabled ? "bg-(--money)/20 text-(--money)" : "bg-(--surface-2) text-text-ghost"
                }`}
              >
                {enabled ? "actif" : "inactif"}
              </span>
            </div>
          ))}
          {Object.keys(flags).length === 0 && (
            <p className="t-13 text-text-ghost col-span-full">Aucun feature flag configuré</p>
          )}
        </div>
      </section>

      {/* Settings by category */}
      {categories.map((cat) => (
        <section key={cat}>
          <h2 className="t-10 font-mono uppercase tracking-(--tracking-stretch) text-text-faint mb-(--space-3) capitalize">
            {cat.replace(/_/g, " ")}
          </h2>
          <div className="rounded-(--radius-md) bg-(--card-flat-bg) border border-(--card-flat-border) divide-y divide-(--card-flat-border)">
            {settings
              .filter((s) => s.category === cat)
              .map((s) => (
                <div
                  key={s.id}
                  className="px-(--space-4) py-(--space-3) flex items-center justify-between"
                >
                  <div className="min-w-0">
                    <p className="t-13 text-text-soft font-mono truncate">{s.key}</p>
                    {s.description && (
                      <p className="t-10 text-text-ghost mt-(--space-1)">{s.description}</p>
                    )}
                  </div>
                  <div className="ml-(--space-4) text-right flex-shrink-0">
                    <p className="t-13 text-text-muted font-mono max-w-[var(--width-admin-code-clip)] truncate">
                      {s.isEncrypted
                        ? "••••••"
                        : typeof s.value === "object"
                          ? JSON.stringify(s.value).slice(0, 40)
                          : String(s.value)}
                    </p>
                    {s.tenantId && (
                      <p className="t-10 text-text-faint mt-(--space-1)">
                        tenant: {s.tenantId.slice(0, 8)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
