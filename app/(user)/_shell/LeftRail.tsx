"use client";

import { signOut, useSession } from "next-auth/react";
import { useStageStore } from "@/stores/stage";

/**
 * LeftRail — barre latérale gauche, structure identique au Master Vault Cortex.
 * Utilise les classes ct-rail-* du package @hearst/cockpit-shell.
 */

function UserAvatar() {
  const { data: session } = useSession();
  const name = session?.user?.name ?? "?";
  const initial = name.slice(0, 2).toUpperCase();
  const image = session?.user?.image;

  if (image) {
    return (
      <button
        type="button"
        className="ct-avatar"
        title="Profil"
        aria-label="Profil utilisateur"
        onClick={() => void signOut({ callbackUrl: "/login" })}
      >
        <img
          src={image}
          alt={name}
          style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }}
        />
      </button>
    );
  }

  return (
    <button
      type="button"
      className="ct-avatar"
      title="Profil"
      aria-label="Profil utilisateur"
      onClick={() => void signOut({ callbackUrl: "/login" })}
    >
      {initial}
    </button>
  );
}

export function LeftRail() {
  const setCommandeurOpen = useStageStore((s) => s.setCommandeurOpen);
  const setMode = useStageStore((s) => s.setMode);

  return (
    <aside className="ct-rail-left">
      {/* Logo */}
      <a
        href="#"
        className="ct-logo-slot"
        title="Helm"
        onClick={(e) => {
          e.preventDefault();
          setMode({ mode: "cockpit" });
        }}
      >
        <img src="/hearst-h.svg" alt="Helm" style={{ width: 22, height: 24, opacity: 0.9 }} />
      </a>

      {/* Actions principales */}
      <div className="ct-rail-actions">
        <button
          type="button"
          className="ct-rail-action accent"
          title="Nouvelle mission"
          aria-label="Nouvelle mission"
          onClick={() => setMode({ mode: "chat" })}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>

        <button
          type="button"
          className="ct-rail-action"
          title="Assets"
          aria-label="Assets"
          onClick={() => setMode({ mode: "asset", assetId: "" })}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <rect x="3" y="6" width="18" height="13" rx="2" />
            <circle cx="12" cy="12.5" r="3.5" />
          </svg>
        </button>

        <button
          type="button"
          className="ct-rail-action"
          title="Commandeur (⌘K)"
          aria-label="Commandeur"
          onClick={() => setCommandeurOpen(true)}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="7" />
            <line x1="16.5" y1="16.5" x2="21" y2="21" />
          </svg>
        </button>

        <div className="ct-rail-divider" />

        <button
          type="button"
          className="ct-rail-action"
          title="Voice prompt"
          aria-label="Voice prompt"
          onClick={() => setMode({ mode: "voice" })}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <rect x="9" y="3" width="6" height="13" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0" />
            <line x1="12" y1="18" x2="12" y2="22" />
          </svg>
        </button>
      </div>

      <div className="ct-spacer" />

      {/* Bottom */}
      <div className="ct-rail-bottom">
        <button
          type="button"
          className="ct-rail-badge"
          title="Connexions"
          aria-label="Connexions et services"
          onClick={() => setMode({ mode: "connections" })}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          <span className="ct-rail-badge-dot" aria-label="En ligne" />
        </button>

        <button type="button" className="ct-rail-settings" title="Settings" aria-label="Settings">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>

        <UserAvatar />
      </div>
    </aside>
  );
}
