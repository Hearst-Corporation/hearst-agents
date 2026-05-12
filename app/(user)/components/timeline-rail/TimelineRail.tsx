"use client";

/**
 * TimelineRail — Rail gauche multi-objet, post-pivot 2026-04-29.
 *
 * Orchestrateur du rail : lit la session, le store de navigation et le
 * store de stage, calcule les groupes temporels et délègue le rendu à
 * RailHeader / RailCollapsedBody | RailExpandedBody / RailFooter.
 *
 * Spec : `docs/features/timeline-rail.md` (statut : verrouillé v1.1).
 *
 * Invariants ADD respectés ici :
 *   I-1. Sections Investigations + Archive toujours rendues (avec empty
 *        state interne) — RailExpandedBody.
 *   I-3. handleThreadSelect → setActiveThread + setStageMode chat
 *        (jamais séparés).
 *   I-4. Largeur via tokens --width-threads / --width-threads-collapsed,
 *        transition slow ease-out-soft.
 *   I-5. Collapsed mode → max 12 tiles (RailCollapsedBody).
 *   I-8. handleHome → setActiveThread(null) + setStageMode cockpit.
 *   I-9. handleNewThread → addThread("New", "home") puis setStageMode
 *        chat avec l'id retourné.
 *   I-10. Logo via HearstLogo en expanded, "H" teal sourd en collapsed.
 */

import { useCallback, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useNavigationStore, type Thread } from "@/stores/navigation";
import { useStageStore } from "@/stores/stage";
import { useOAuthExpiry } from "@/app/hooks/use-oauth-expiry";
import { toast } from "@/app/hooks/use-toast";
import { ConfirmModal } from "../ConfirmModal";
import { RailHeader } from "./RailHeader";
import { RailFooter } from "./RailFooter";
import { RailCollapsedBody } from "./RailCollapsedBody";
import { RailExpandedBody } from "./RailExpandedBody";
import { groupThreadsByDate } from "./shared";

export function TimelineRail() {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const {
    threads,
    activeThreadId,
    setActiveThread,
    addThread,
    removeThread,
    toggleArchived,
    leftCollapsed,
    toggleLeftCollapsed,
  } = useNavigationStore();
  const setStageMode = useStageStore((s) => s.setMode);
  const { connections: expiringConnections, severity: oauthSeverity } = useOAuthExpiry();
  const firstName = session?.user?.name?.split(" ")[0] || "Utilisateur";
  const isHomeActive = pathname === "/";
  const isAppsActive = pathname === "/apps" || pathname?.startsWith("/apps/") === true;

  // Tooltip Apps : résume l'état OAuth — pluriel/singulier + service en clair.
  const oauthBadgeTitle = (() => {
    if (!oauthSeverity || expiringConnections.length === 0) return undefined;
    const count = expiringConnections.length;
    const expired = expiringConnections.filter((c) => c.status === "expired").length;
    if (expired > 0) {
      return expired === 1
        ? `1 connexion expirée — reconnecter`
        : `${expired} connexions expirées — reconnecter`;
    }
    return count === 1
      ? `1 connexion expire bientôt`
      : `${count} connexions expirent bientôt`;
  })();

  const sectionPadX = leftCollapsed ? "pl-6 pr-2" : "px-8";

  const groups = useMemo(() => groupThreadsByDate(threads), [threads]);
  const [confirmDeleteThread, setConfirmDeleteThread] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Archive : toggle réversible. On annonce explicitement l'action via toast
  // pour éviter la confusion « supprimé / archivé », et on indique où retrouver
  // l'item (/archive). Undo dispo via re-toggle dans /archive.
  const handleArchive = useCallback((id: string) => {
    const thread = threads.find((t) => t.id === id);
    const wasArchived = thread?.archived === true;
    toggleArchived(id);
    if (!wasArchived) {
      toast.info("Conversation archivée", "Retrouve-la dans Archive (⌘K → « Voir l'archive »)");
    } else {
      toast.info("Conversation restaurée", "Elle réapparaît dans Investigations.");
    }
  }, [threads, toggleArchived]);

  const handleThreadSelect = (threadId: string) => {
    setActiveThread(threadId);
    setStageMode({ mode: "chat", threadId });
    if (pathname !== "/") router.push("/");
  };

  const requestThreadDelete = (thread: Thread) => {
    setConfirmDeleteThread({ id: thread.id, name: thread.name });
  };

  const confirmThreadDelete = () => {
    if (!confirmDeleteThread) return;
    if (confirmDeleteThread.id === activeThreadId) setActiveThread(null);
    removeThread(confirmDeleteThread.id);
    setConfirmDeleteThread(null);
  };

  const handleNewThread = () => {
    const id = addThread("New", "home");
    setStageMode({ mode: "chat", threadId: id });
    if (pathname !== "/") router.push("/");
  };

  const handleHome = () => {
    setActiveThread(null);
    setStageMode({ mode: "cockpit" });
    if (pathname !== "/") router.push("/");
  };

  return (
    <aside
      className="h-full flex flex-col z-20 relative transition-[width] duration-slow ease-out-soft overflow-hidden"
      style={{
        width: leftCollapsed ? "var(--width-threads-collapsed)" : "var(--width-threads)",
        background: "var(--rail)",
      }}
    >
      <RailHeader collapsed={leftCollapsed} onHome={handleHome} />

      <div className={`flex-1 flex flex-col min-h-0 pt-8 pb-8 ${sectionPadX}`}>
        {leftCollapsed ? (
          <RailCollapsedBody
            threads={threads}
            activeThreadId={activeThreadId}
            isAppsActive={isAppsActive}
            oauthSeverity={oauthSeverity}
            oauthBadgeTitle={oauthBadgeTitle}
            onNewThread={handleNewThread}
            onSelectThread={handleThreadSelect}
          />
        ) : (
          <RailExpandedBody
            groups={groups}
            activeThreadId={activeThreadId}
            isHomeActive={isHomeActive}
            isAppsActive={isAppsActive}
            oauthSeverity={oauthSeverity}
            oauthBadgeTitle={oauthBadgeTitle}
            onHome={handleHome}
            onNewThread={handleNewThread}
            onSelectThread={handleThreadSelect}
            onArchiveThread={handleArchive}
            onRequestDelete={requestThreadDelete}
          />
        )}
      </div>

      <RailFooter
        collapsed={leftCollapsed}
        firstName={firstName}
        sectionPadX={sectionPadX}
        onToggleCollapsed={toggleLeftCollapsed}
      />

      <ConfirmModal
        open={confirmDeleteThread !== null}
        title="Supprimer cette conversation ?"
        description={
          confirmDeleteThread
            ? `« ${confirmDeleteThread.name} » sera supprimée définitivement. Cette action est irréversible.`
            : undefined
        }
        confirmLabel="Supprimer"
        variant="danger"
        onConfirm={confirmThreadDelete}
        onCancel={() => setConfirmDeleteThread(null)}
      />
    </aside>
  );
}
