/**
 * RailFooter — bas du rail : avatar + statut + Admin/Exit + toggle collapse.
 *
 * Deux variantes (collapsed / expanded) qui partagent les mêmes actions
 * (admin, signOut, toggleCollapsed). En collapsed : icônes + dot teal.
 * En expanded : avatar initiale + nom + rôle + GhostFooterLinks.
 */

import Link from "next/link";
import { signOut } from "next-auth/react";
import { AdminIcon, ChevronLeftIcon, ChevronRightIcon, LogoutIcon } from "./icons";
import { GhostFooterLink } from "./GhostFooterLink";

export interface RailFooterProps {
  collapsed: boolean;
  firstName: string;
  sectionPadX: string;
  onToggleCollapsed: () => void;
}

export function RailFooter({
  collapsed,
  firstName,
  sectionPadX,
  onToggleCollapsed,
}: RailFooterProps) {
  return (
    <div
      className={`shrink-0 flex flex-col ${collapsed ? "items-center" : "items-start"} ${sectionPadX}`}
      style={{
        paddingTop: "var(--space-4)",
        paddingBottom: "var(--space-6)",
        gap: "var(--space-3)",
      }}
    >
      {collapsed ? (
        <>
          <span
            className="rounded-pill"
            style={{
              width: "var(--space-2)",
              height: "var(--space-2)",
              background: "var(--accent-teal)",
              boxShadow: "var(--shadow-neon-accent-teal)",
            }}
            title={firstName}
            aria-label={`${firstName} en ligne`}
          />
          <Link
            href="/admin"
            title="Admin console"
            className="w-6 h-6 flex items-center justify-center text-text-ghost hover:text-(--accent-teal) transition-colors"
          >
            <AdminIcon />
          </Link>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Déconnexion"
            aria-label="Déconnexion"
            className="w-6 h-6 flex items-center justify-center text-text-ghost hover:text-(--danger) transition-colors"
          >
            <LogoutIcon />
          </button>
          <button
            onClick={onToggleCollapsed}
            title="Déplier"
            aria-label="Déplier le rail"
            className="w-6 h-5 flex items-center justify-center text-text-ghost hover:text-(--accent-teal) transition-colors"
          >
            <ChevronRightIcon />
          </button>
        </>
      ) : (
        <>
          {/* Avatar + nom + rôle */}
          <div className="flex items-center w-full" style={{ gap: "var(--space-3)" }}>
            <div
              className="relative shrink-0 flex items-center justify-center rounded-pill"
              style={{
                width: "var(--size-avatar-sm)",
                height: "var(--size-avatar-sm)",
                background: "var(--surface-2)",
                border: "1px solid var(--border-soft)",
              }}
            >
              <span className="t-13 font-medium" style={{ color: "var(--text-l1)" }}>
                {firstName.charAt(0).toUpperCase()}
              </span>
              <span
                className="absolute rounded-pill"
                style={{
                  width: "var(--space-1)",
                  height: "var(--space-1)",
                  background: "var(--accent-teal)",
                  boxShadow: "var(--shadow-neon-accent-teal)",
                  bottom: "1px",
                  right: "1px",
                }}
                aria-hidden
              />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="t-13 font-medium truncate" style={{ color: "var(--text-l1)" }}>
                {firstName}
              </span>
              <span className="t-9 font-light" style={{ color: "var(--text-faint)" }}>
                Admin
              </span>
            </div>
          </div>
          {/* Actions footer */}
          <div className="flex items-center" style={{ gap: "var(--space-3)" }}>
            <GhostFooterLink href="/admin" title="Admin console">
              Admin
            </GhostFooterLink>
            <GhostFooterLink
              onClick={() => signOut({ callbackUrl: "/login" })}
              title="Déconnexion"
            >
              Exit
            </GhostFooterLink>
          </div>
          <button
            onClick={onToggleCollapsed}
            title="Replier"
            aria-label="Replier le rail"
            className="w-5 h-5 flex items-center justify-center text-text-ghost hover:text-(--accent-teal) transition-colors mt-2"
          >
            <ChevronLeftIcon />
          </button>
        </>
      )}
    </div>
  );
}
