/**
 * RailCollapsedBody — corps du rail en mode collapsed.
 *
 * Bouton "nouvelle conversation" + bouton Apps (avec badge OAuth) +
 * liste de tuiles (max 12, I-5). Pas d'investigations regroupées en
 * collapsed : on garde l'information dense et compacte.
 */

import { useRouter } from "next/navigation";
import type { Thread } from "@/stores/navigation";
import { AppIcon, PlusIcon } from "./icons";
import { CollapsedTile } from "./CollapsedTile";
import type { BadgeSeverity } from "./TopMenuItem";

export interface RailCollapsedBodyProps {
  threads: Thread[];
  activeThreadId: string | null;
  isAppsActive: boolean;
  oauthSeverity: BadgeSeverity;
  oauthBadgeTitle: string | undefined;
  onNewThread: () => void;
  onSelectThread: (id: string) => void;
}

const COLLAPSED_TILE_LIMIT = 12;

export function RailCollapsedBody({
  threads,
  activeThreadId,
  isAppsActive,
  oauthSeverity,
  oauthBadgeTitle,
  onNewThread,
  onSelectThread,
}: RailCollapsedBodyProps) {
  const router = useRouter();
  return (
    <>
      <button
        onClick={onNewThread}
        className="mb-3 w-8 h-8 flex items-center justify-center rounded-md border border-(--border-subtle) text-text-faint hover:text-(--accent-teal) hover:border-[var(--accent-teal-border)] hover:bg-[var(--accent-teal-bg-hover)] transition-all duration-(--duration-slow) ease-(--ease-out-soft) shrink-0"
        title="Nouvelle conversation"
      >
        <PlusIcon />
      </button>
      {/* Apps en collapsed — icon-only bouton avec badge OAuth.
       *  Cohérence avec l'expanded mode : Apps reste accessible et le
       *  signal de reconnexion n'est pas perdu quand le rail se replie. */}
      <button
        onClick={() => router.push("/apps")}
        aria-current={isAppsActive ? "page" : undefined}
        className={`relative mb-6 w-8 h-8 flex items-center justify-center rounded-md border transition-all duration-(--duration-slow) ease-(--ease-out-soft) shrink-0 ${
          isAppsActive
            ? "border-[var(--accent-teal-border)] bg-[var(--accent-teal-bg-active)] text-(--accent-teal)"
            : "border-(--border-subtle) text-text-faint hover:text-(--accent-teal) hover:border-[var(--accent-teal-border)] hover:bg-[var(--accent-teal-bg-hover)]"
        }`}
        title={oauthBadgeTitle ?? "Apps"}
      >
        <AppIcon />
        {oauthSeverity && (
          <span
            aria-hidden
            className="absolute rounded-pill"
            style={{
              top: "-2px",
              right: "-2px",
              width: "var(--space-2)",
              height: "var(--space-2)",
              background:
                oauthSeverity === "error" ? "var(--color-error)" : "var(--warn)",
              boxShadow: `0 0 0 1.5px var(--rail)`,
            }}
          />
        )}
      </button>

      <div className="overflow-y-auto scrollbar-hide flex-1 flex flex-col items-center gap-3">
        {threads.slice(0, COLLAPSED_TILE_LIMIT).map((t) => (
          <CollapsedTile
            key={t.id}
            thread={t}
            isActive={t.id === activeThreadId}
            onSelect={() => onSelectThread(t.id)}
          />
        ))}
      </div>
    </>
  );
}
