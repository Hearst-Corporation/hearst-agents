"use client";

import { useState } from "react";
import { StandalonePageFrame } from "@/app/(user)/components/standalone/StandalonePageFrame";
import { Action, EmptyState, FilterTabs, ScreenShell } from "@/app/(user)/components/ui";
import { useNotificationsStore } from "@/stores/notifications";

const TABS = ["Tout", "Critique", "Alerte", "Info"] as const;
type Tab = (typeof TABS)[number];

function BellIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden>
      <path
        d="M20 6a10 10 0 0 1 10 10v6l3 4H7l3-4v-6A10 10 0 0 1 20 6z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M17 30a3 3 0 0 0 6 0"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Tout");
  const markAllRead = useNotificationsStore((s) => s.markAllRead);
  const unreadCount = useNotificationsStore((s) => s.unreadCount);
  const notifications = useNotificationsStore((s) => s.notifications);

  // Filtrer par tab active (severity)
  const filteredNotifs = notifications.filter((n) => {
    if (activeTab === "Tout") return true;
    return n.severity === activeTab.toLowerCase();
  });

  return (
    <StandalonePageFrame>
      <ScreenShell
        title="Notifications"
        subtitle="Signaux, rapports, exports"
        actions={
          unreadCount > 0 ? (
            <Action variant="link" tone="brand" size="sm" onClick={() => void markAllRead()}>
              Tout marquer comme lu
            </Action>
          ) : null
        }
      >
        <FilterTabs
          tabs={TABS}
          active={activeTab}
          aria-label="Filtrer les notifications"
          onValueChange={(v) => setActiveTab(v as Tab)}
        />
        {filteredNotifs.length === 0 && (
          <EmptyState
            title="Aucune notification"
            description="Tout est calme pour l'instant"
            icon={<BellIcon />}
          />
        )}
      </ScreenShell>
    </StandalonePageFrame>
  );
}
