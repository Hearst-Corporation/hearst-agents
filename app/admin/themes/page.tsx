/**
 * /admin/themes — Apparence : sélection du thème UI.
 *
 * Le registry est statique côté code (themes/_registry.ts), auto-géré par /skin.
 * La préférence user persiste en DB via /api/user/theme (table user_theme_preferences).
 */

import { REGISTRY } from "@/themes/_registry";
import { ThemePicker } from "../_components/ThemePicker";

export const dynamic = "force-dynamic";

export default function ThemesPage() {
  return (
    <div className="p-(--space-8) space-y-(--space-8) text-text-soft h-full overflow-y-auto">
      <header className="space-y-(--space-2)">
        <h1 className="t-24 text-(--ct-text-strong) font-light">Apparence</h1>
        <p className="text-(--text-muted)">
          Choisis le design system de l&apos;application. Le switch est immédiat et persiste sur ton
          compte. Les nouveaux thèmes sont ajoutés via{" "}
          <code className="text-xs bg-(--bg-elev) px-1.5 py-0.5 rounded">/skin &lt;url&gt;</code> en
          CLI.
        </p>
      </header>

      <ThemePicker themes={REGISTRY} />
    </div>
  );
}
