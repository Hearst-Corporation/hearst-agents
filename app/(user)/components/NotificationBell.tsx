"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useNotificationsStore } from "@/stores/notifications";
import type { AppNotification } from "@/stores/notifications";

// ── Icônes inline (aucune dépendance externe) ──────────────────────────────

function BellIcon({ hasUnread }: { hasUnread: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke={hasUnread ? "var(--text)" : "var(--text-muted)"}
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function SeverityDot({ severity }: { severity: AppNotification["severity"] }) {
  const color =
    severity === "critical"
      ? "var(--danger)"
      : severity === "warning"
        ? "var(--warn)"
        : "var(--color-info)";
  return (
    <span
      style={{
        width: "var(--space-2)",
        height: "var(--space-2)",
        borderRadius: "var(--radius-pill)",
        background: color,
        flexShrink: 0,
        display: "inline-block",
        marginTop: "var(--space-1)",
      }}
    />
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function relativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Il y a ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `Il y a ${days}j`;
}

function kindLabel(kind: AppNotification["kind"]): string {
  switch (kind) {
    case "signal":
      return "Signal";
    case "report_ready":
      return "Rapport prêt";
    case "export_done":
      return "Export terminé";
    case "share_viewed":
      return "Partage consulté";
  }
}

// ── Composant principal ────────────────────────────────────────────────────

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: session, status: sessionStatus } = useSession();

  const notifications = useNotificationsStore((s) => s.notifications);
  const unreadCount = useNotificationsStore((s) => s.unreadCount);
  const loading = useNotificationsStore((s) => s.loading);
  const markRead = useNotificationsStore((s) => s.markRead);
  const markAllRead = useNotificationsStore((s) => s.markAllRead);
  const startRealtime = useNotificationsStore((s) => s.startRealtime);
  const stopPolling = useNotificationsStore((s) => s.stopPolling);

  // Realtime Supabase — fallback polling 60s si le channel échoue.
  // tenantId lu depuis la session JWT (source de vérité).
  useEffect(() => {
    // Ignore l'état "loading" : la session se résout en async, c'est normal
    // que tenantId soit transitoirement undefined. Le warning ne doit se
    // déclencher que sur un user authentifié dont la session est vraiment
    // dépourvue de tenantId (signal d'une régression callback jwt).
    if (sessionStatus !== "authenticated") return;
    const tenantId = (session?.user as { tenantId?: string } | undefined)?.tenantId;
    if (!tenantId) {
      console.warn("[NotificationBell] session.user.tenantId absent — realtime notifications désactivé");
      return;
    }
    startRealtime(tenantId);
    return () => stopPolling();
  }, [session, sessionStatus, startRealtime, stopPolling]);

  // Ferme le dropdown si clic extérieur
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Ferme avec Echap
  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const preview = notifications.slice(0, 10);
  const hasUnread = unreadCount > 0;

  return (
    <div ref={containerRef} className="relative inline-flex">
      {/* Bouton cloche */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${hasUnread ? ` (${unreadCount} non lues)` : ""}`}
        aria-expanded={open}
        className={`relative inline-flex items-center justify-center rounded-md border-none cursor-pointer outline-none transition-colors duration-(--duration-base) ease-(--ease-standard) hover:bg-surface-1 focus-visible:ring-1 focus-visible:ring-[var(--accent-teal-border)] ${
          open ? "bg-surface-2" : "bg-transparent"
        }`}
        style={{
          width: "var(--space-8)",
          height: "var(--space-8)",
        }}
      >
        <BellIcon hasUnread={hasUnread} />
        {/* Badge */}
        {hasUnread && (
          <span
            aria-hidden
            className="t-9"
            style={{
              position: "absolute",
              top: "var(--space-1)",
              right: "var(--space-1)",
              minWidth: "var(--space-4)",
              height: "var(--space-4)",
              borderRadius: "var(--radius-pill)",
              background: "var(--danger)",
              color: "var(--text)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 var(--space-1)",
              lineHeight: 1,
              fontWeight: "var(--weight-bold)" as string,
              letterSpacing: "var(--tracking-hairline)",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Notifications"
          style={{
            position: "absolute",
            top: "calc(100% + var(--space-2))",
            right: 0,
            width: "var(--width-popover)",
            borderRadius: "var(--radius-lg)",
            background: "var(--bg-elev)",
            border: "1px solid var(--border-default)",
            boxShadow: "var(--shadow-card)",
            zIndex: "var(--z-modal)" as unknown as number,
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "var(--space-3) var(--space-4)",
              borderBottom: "1px solid var(--border-subtle)",
            }}
          >
            <span
              className="t-11"
              style={{
                color: "var(--text-soft)",
                fontWeight: "var(--weight-semibold)" as string,
              }}
            >
              Notifications
            </span>
            <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
              {loading && (
                <span className="t-9" style={{ color: "var(--text-faint)" }}>
                  Actualisation…
                </span>
              )}
              {hasUnread && (
                <button
                  onClick={() => void markAllRead()}
                  className="t-9 hover:opacity-70 transition-opacity"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--accent-teal)",
                    padding: "var(--space-1) var(--space-2)",
                    borderRadius: "var(--radius-xs)",
                    letterSpacing: "var(--tracking-hairline)",
                  }}
                >
                  Tout marquer lu
                </button>
              )}
            </div>
          </div>

          {/* Liste */}
          <div
            style={{
              maxHeight: "var(--max-height-notification-popover)",
              overflowY: "auto",
            }}
          >
            {preview.length === 0 ? (
              <div
                style={{
                  padding: "var(--space-8) var(--space-4)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "var(--space-2)",
                }}
              >
                <span
                  style={{ color: "var(--text-ghost)", display: "inline-flex" }}
                  aria-hidden
                >
                  <BellIcon hasUnread={false} />
                </span>
                <span className="t-11" style={{ color: "var(--text-faint)" }}>
                  Pas encore de notification
                </span>
              </div>
            ) : (
              preview.map((notif) => (
                <NotifRow
                  key={notif.id}
                  notif={notif}
                  onRead={() => void markRead(notif.id)}
                />
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 10 && (
            <div
              style={{
                padding: "var(--space-2) var(--space-4)",
                borderTop: "1px solid var(--border-subtle)",
                textAlign: "center",
              }}
            >
              <a
                href="/notifications"
                className="t-9"
                onClick={() => setOpen(false)}
                style={{
                  color: "var(--accent-teal)",
                  textDecoration: "none",
                  letterSpacing: "var(--tracking-hairline)",
                }}
              >
                Voir toutes les notifications →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Ligne notification ─────────────────────────────────────────────────────

function NotifRow({
  notif,
  onRead,
}: {
  notif: AppNotification;
  onRead: () => void;
}) {
  const isUnread = notif.read_at === null;

  return (
    <button
      onClick={onRead}
      className="w-full flex text-left border-none cursor-pointer hover:bg-surface-2 transition-colors duration-(--duration-fast) ease-(--ease-standard)"
      style={{
        gap: "var(--space-3)",
        padding: "var(--space-3) var(--space-4)",
        background: isUnread ? "var(--surface-1)" : "transparent",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <SeverityDot severity={notif.severity} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-2)" }}>
          <span
            className="t-11"
            style={{
              color: isUnread ? "var(--text-soft)" : "var(--text-muted)",
              fontWeight: isUnread
                ? ("var(--weight-semibold)" as string)
                : ("var(--weight-regular)" as string),
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
            }}
          >
            {notif.title}
          </span>
          <span
            className="t-9"
            style={{
              color: "var(--text-ghost)",
              whiteSpace: "nowrap",
              letterSpacing: "var(--tracking-hairline)",
              flexShrink: 0,
            }}
          >
            {relativeTime(notif.created_at)}
          </span>
        </div>
        {notif.body && (
          <p
            className="t-10"
            style={{
              color: "var(--text-faint)",
              margin: 0,
              marginTop: "var(--space-1)",
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {notif.body}
          </p>
        )}
        <span
          className="t-9"
          style={{
            color: "var(--text-ghost)",
            marginTop: "var(--space-1)",
            display: "block",
          }}
        >
          {kindLabel(notif.kind)}
        </span>
      </div>
    </button>
  );
}
