'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useNotificationsStore } from '@/stores/notifications';
import { SPATIAL_Z_LAYERS } from '@/lib/spatial/constants';

/**
 * Notif bell — version glass spatial.
 *
 * Branchée sur `useNotificationsStore.startRealtime(tenantId)` au mount.
 * Affiche un dot sourd avec count si unread > 0. Click → bascule sur `/`
 * (aucun popover spatial : on délègue au NotificationBell classique de la
 * shell pour éviter de dupliquer la list).
 */
export function NotificationBellSpatial() {
  const { data: session } = useSession();
  const startRealtime = useNotificationsStore((s) => s.startRealtime);
  const stopPolling = useNotificationsStore((s) => s.stopPolling);
  const unreadCount = useNotificationsStore((s) => s.unreadCount);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const tenantId = (session?.user as { tenantId?: string } | undefined)?.tenantId;
    if (!tenantId) return;
    startRealtime(tenantId);
    return () => stopPolling();
  }, [session, startRealtime, stopPolling]);

  function handleClick() {
    // Délègue au shell classique
    if (typeof window !== 'undefined') window.location.href = '/notifications';
  }

  const hasUnread = unreadCount > 0;

  return (
    <div
      className="pointer-events-none absolute top-6 right-6 md:top-10 md:right-10"
      style={{ zIndex: SPATIAL_Z_LAYERS.hud }}
    >
      <button
        type="button"
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-label={`Notifications${hasUnread ? ` (${unreadCount} non lues)` : ''}`}
        className="pointer-events-auto relative flex items-center justify-center rounded-full transition-colors duration-300"
        style={{
          width: 44,
          height: 44,
          background: hovered ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
          backdropFilter: 'blur(18px) saturate(140%)',
          WebkitBackdropFilter: 'blur(18px) saturate(140%)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke={hasUnread ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.5)'}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {hasUnread && (
          <span
            aria-hidden
            className="absolute"
            style={{
              top: 6,
              right: 6,
              width: 10,
              height: 10,
              borderRadius: 999,
              background: 'rgba(120,220,220,0.95)',
              boxShadow: '0 0 8px rgba(120,220,220,0.7)',
            }}
          />
        )}
      </button>
    </div>
  );
}
