"use client";

import { StandalonePageFrame } from "@/app/(user)/components/standalone/StandalonePageFrame";
import { Action, EmptyState, FilterTabs, ScreenShell } from "@/app/(user)/components/ui";

const TABS = ["Tout", "Critique", "Alerte", "Info"] as const;

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
  return (
    <StandalonePageFrame>
      <ScreenShell
        title="Notifications"
        subtitle="Signaux, rapports, exports"
        actions={
          <Action variant="link" tone="brand" size="sm">
            Tout marquer comme lu
          </Action>
        }
      >
        <FilterTabs tabs={TABS} active="Tout" aria-label="Filtrer les notifications" />
        <EmptyState
          title="Aucune notification"
          description="Tout est calme pour l'instant"
          icon={<BellIcon />}
        />
      </ScreenShell>
    </StandalonePageFrame>
  );
}
