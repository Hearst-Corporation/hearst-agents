/**
 * RailExpandedBody — corps du rail en mode expanded.
 *
 * Top menu (Home, Apps, Chat) + section Investigations (today + thisWeek)
 * pliable + section Archive conditionnelle. Les 4 sections canoniques
 * sont toujours rendues avec leur empty state interne (I-1).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Thread } from "@/stores/navigation";
import { AppIcon, ChatIcon, ChevronDownIcon, HomeIcon } from "./icons";
import { TopMenuItem, type BadgeSeverity } from "./TopMenuItem";
import { ThreadRow } from "./ThreadRow";
import { SectionHeader, EmptyHint } from "./SectionHeader";
import type { ThreadGroups } from "./shared";

export interface RailExpandedBodyProps {
  groups: ThreadGroups;
  activeThreadId: string | null;
  isHomeActive: boolean;
  isAppsActive: boolean;
  oauthSeverity: BadgeSeverity;
  oauthBadgeTitle: string | undefined;
  onHome: () => void;
  onNewThread: () => void;
  onSelectThread: (id: string) => void;
  onArchiveThread: (id: string) => void;
  onRequestDelete: (thread: Thread) => void;
}

export function RailExpandedBody({
  groups,
  activeThreadId,
  isHomeActive,
  isAppsActive,
  oauthSeverity,
  oauthBadgeTitle,
  onHome,
  onNewThread,
  onSelectThread,
  onArchiveThread,
  onRequestDelete,
}: RailExpandedBodyProps) {
  const router = useRouter();
  const [recentsExpanded, setRecentsExpanded] = useState(true);

  return (
    <div
      className="overflow-y-auto scrollbar-hide flex-1 flex flex-col"
      style={{ gap: "var(--space-2)" }}
    >
      {/* Top Menu — deux groupes, séparés par l'air uniquement */}
      <div
        className="flex flex-col mb-2"
        style={{
          borderBottom: "1px solid var(--sep)",
          paddingBottom: "var(--space-1)",
        }}
      >
        <div className="flex flex-col">
          <TopMenuItem
            label="Home"
            icon={<HomeIcon />}
            isActive={isHomeActive}
            onClick={onHome}
          />
          <TopMenuItem
            label="Apps"
            icon={<AppIcon />}
            isActive={isAppsActive}
            badge={oauthSeverity}
            badgeTitle={oauthBadgeTitle}
            onClick={() => router.push("/apps")}
          />
        </div>
        <div className="flex flex-col" style={{ marginTop: "var(--space-2)" }}>
          <TopMenuItem
            label="Chat"
            icon={<ChatIcon />}
            onClick={onNewThread}
          />
        </div>
      </div>

      {/* Investigations — toggleable */}
      <section>
        <button
          type="button"
          onClick={() => setRecentsExpanded((v) => !v)}
          aria-expanded={recentsExpanded}
          className="w-full flex items-center justify-between first:mt-0 mt-12 mb-6 px-3 group"
        >
          <span
            className="t-11 font-medium transition-colors group-hover:text-text-soft"
            style={{ color: "var(--text-faint)" }}
          >
            Conversations
          </span>
          <span
            className="inline-flex items-center justify-center transition-transform duration-emphasis ease-out-soft text-text-faint group-hover:text-text-soft"
            style={{
              transform: recentsExpanded ? "rotate(0deg)" : "rotate(-90deg)",
            }}
            aria-hidden
          >
            <ChevronDownIcon />
          </span>
        </button>
        {recentsExpanded &&
          (groups.today.length === 0 && groups.thisWeek.length === 0 ? (
            <EmptyHint>Aucune activité récente</EmptyHint>
          ) : (
            <div className="space-y-px">
              {groups.today.map((t) => (
                <ThreadRow
                  key={t.id}
                  thread={t}
                  isActive={t.id === activeThreadId}
                  onSelect={() => onSelectThread(t.id)}
                  onDelete={() => onRequestDelete(t)}
                  onArchive={() => onArchiveThread(t.id)}
                />
              ))}
              {groups.thisWeek.map((t) => (
                <ThreadRow
                  key={t.id}
                  thread={t}
                  isActive={t.id === activeThreadId}
                  onSelect={() => onSelectThread(t.id)}
                  onDelete={() => onRequestDelete(t)}
                  onArchive={() => onArchiveThread(t.id)}
                />
              ))}
            </div>
          ))}
      </section>

      {/* Archive */}
      {groups.archive.length > 0 && (
        <section>
          <SectionHeader label="Archive" />
          <div className="space-y-px">
            {groups.archive.map((t) => (
              <ThreadRow
                key={t.id}
                thread={t}
                isActive={t.id === activeThreadId}
                onSelect={() => onSelectThread(t.id)}
                onDelete={() => onRequestDelete(t)}
                onArchive={() => onArchiveThread(t.id)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
