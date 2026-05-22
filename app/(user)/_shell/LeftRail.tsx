"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { RAIL_STAGES, STAGE_REGISTRY } from "@/app/(user)/_stages/registry";
import { type StageMode, type StagePayload, useStageStore } from "@/stores/stage";

/**
 * LeftRail — barre latérale gauche 88px, scrollable.
 * Expose tous les stages (via RAIL_STAGES), les pages standalone,
 * le Commandeur, les Connexions, Settings et l'avatar.
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

/** Retourne le payload idle-safe pour un mode donné. */
function idlePayload(mode: StageMode): StagePayload {
  switch (mode) {
    case "asset":
      return { mode: "asset", assetId: "" };
    case "asset_compare":
      return { mode: "asset_compare", assetIds: [] };
    case "browser":
      return { mode: "browser", sessionId: "" };
    case "meeting":
      return { mode: "meeting", meetingId: "" };
    default:
      return { mode } as StagePayload;
  }
}

/** Props SVG communes 18×18 — partagées par StageIcon et PageIcon. */
const SVG_PROPS = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
} as const;

/** Icônes SVG 18×18 par mode (viewBox 0 0 24 24, stroke currentColor, sw 2). */
function StageIcon({ mode }: { mode: StageMode }) {
  const p = SVG_PROPS;
  switch (mode) {
    case "chat":
      return (
        <svg {...p}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "mission":
      return (
        <svg {...p}>
          <line x1="9" y1="6" x2="20" y2="6" />
          <line x1="9" y1="12" x2="20" y2="12" />
          <line x1="9" y1="18" x2="20" y2="18" />
          <polyline points="4 6 5.5 7.5 7.5 5" />
          <polyline points="4 12 5.5 13.5 7.5 11" />
          <polyline points="4 18 5.5 19.5 7.5 17" />
        </svg>
      );
    case "asset":
      return (
        <svg {...p}>
          <rect x="3" y="6" width="18" height="13" rx="2" />
          <circle cx="12" cy="12.5" r="3.5" />
        </svg>
      );
    case "asset_compare":
      return (
        <svg {...p}>
          <rect x="2" y="5" width="9" height="14" rx="2" />
          <rect x="13" y="5" width="9" height="14" rx="2" />
        </svg>
      );
    case "browser":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="9" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <path d="M12 3a15 15 0 0 1 4 9 15 15 0 0 1-4 9 15 15 0 0 1-4-9 15 15 0 0 1 4-9z" />
        </svg>
      );
    case "kg":
      return (
        <svg {...p}>
          <circle cx="12" cy="5" r="2" />
          <circle cx="5" cy="19" r="2" />
          <circle cx="19" cy="19" r="2" />
          <line x1="12" y1="7" x2="5" y2="17" />
          <line x1="12" y1="7" x2="19" y2="17" />
          <line x1="7" y1="19" x2="17" y2="19" />
        </svg>
      );
    case "voice":
      return (
        <svg {...p}>
          <rect x="9" y="3" width="6" height="13" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0" />
          <line x1="12" y1="18" x2="12" y2="22" />
        </svg>
      );
    case "simulation":
      return (
        <svg {...p}>
          <polygon points="5 3 19 12 5 21 5 3" />
          <line x1="19" y1="3" x2="19" y2="21" />
        </svg>
      );
    case "meeting":
      return (
        <svg {...p}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case "artifact":
      return (
        <svg {...p}>
          <path d="M12 2l9 4.5V17.5L12 22 3 17.5V6.5L12 2z" />
          <polyline points="3 6.5 12 11 21 6.5" />
          <line x1="12" y1="11" x2="12" y2="22" />
        </svg>
      );
    case "signal":
      return (
        <svg {...p}>
          <path d="M2 12c0-5.5 4.5-10 10-10s10 4.5 10 10" />
          <path d="M6 12c0-3.3 2.7-6 6-6s6 2.7 6 6" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      );
    default:
      return (
        <svg {...p}>
          <rect x="3" y="3" width="18" height="18" rx="3" />
        </svg>
      );
  }
}

/** Icônes SVG pour les pages standalone. */
function PageIcon({ page }: { page: string }) {
  const p = SVG_PROPS;
  switch (page) {
    case "reports":
      return (
        <svg {...p}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="9" y1="13" x2="15" y2="13" />
          <line x1="9" y1="17" x2="15" y2="17" />
        </svg>
      );
    case "studio":
      return (
        <svg {...p}>
          <circle cx="13.5" cy="6.5" r="3.5" />
          <path d="M9.5 17.5a3.5 3.5 0 1 0 7 0 3.5 3.5 0 0 0-7 0z" />
          <path d="M3 11h3M3 17h3M18 11h3M18 17h3" />
        </svg>
      );
    case "marketplace":
      return (
        <svg {...p}>
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
      );
    case "notifications":
      return (
        <svg {...p}>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      );
    case "archive":
      return (
        <svg {...p}>
          <polyline points="21 8 21 21 3 21 3 8" />
          <rect x="1" y="3" width="22" height="5" />
          <line x1="10" y1="12" x2="14" y2="12" />
        </svg>
      );
    case "hospitality":
      return (
        <svg {...p}>
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      );
    case "presentation":
      return (
        <svg {...p}>
          <rect x="3" y="4" width="18" height="12" rx="1" />
          <line x1="12" y1="16" x2="12" y2="20" />
          <line x1="8" y1="20" x2="16" y2="20" />
          <polyline points="8 11 11 8 13 10 16 7" />
        </svg>
      );
    default:
      return (
        <svg {...p}>
          <rect x="3" y="3" width="18" height="18" rx="3" />
        </svg>
      );
  }
}

/**
 * App sœur "hearst-presentation" — surface autonome (Supabase + Vercel dédiés),
 * pas un stage interne. Ouverte en lien cross-domaine (nouvel onglet).
 * URL surchargeable par env ; jamais un secret (domaine public).
 */
const PRESENTATION_URL =
  process.env.NEXT_PUBLIC_PRESENTATION_URL ?? "https://hearst-presentation.vercel.app";

/** Pages standalone exposées dans le rail. `external` = autre app (nouvel onglet). */
const RAIL_PAGES = [
  { key: "reports", href: "/reports", label: "Reports" },
  { key: "studio", href: "/reports/studio", label: "Studio" },
  { key: "marketplace", href: "/marketplace", label: "Marketplace" },
  { key: "notifications", href: "/notifications", label: "Notifications" },
  { key: "archive", href: "/archive", label: "Archive" },
  { key: "hospitality", href: "/hospitality", label: "Hospitality" },
  { key: "presentation", href: PRESENTATION_URL, label: "Presentation", external: true },
] as const;

export function LeftRail() {
  const setCommandeurOpen = useStageStore((s) => s.setCommandeurOpen);
  const setMode = useStageStore((s) => s.setMode);
  const currentMode = useStageStore((s) => s.current.mode);
  const pathname = usePathname();

  return (
    <aside className="ct-rail-left ct-rail-left--scrollable no-scrollbar">
      {/* Logo → cockpit */}
      <button
        type="button"
        className={`ct-logo-slot${currentMode === "cockpit" ? " accent" : ""}`}
        title="Helm — Accueil"
        aria-label="Helm — Accueil"
        onClick={() => {
          setMode({ mode: "cockpit" });
        }}
      >
        <img src="/hearst-h.svg" alt="Helm" style={{ width: 22, height: 24, opacity: 0.9 }} />
      </button>

      {/* Groupe STAGES */}
      <div className="ct-rail-actions">
        {RAIL_STAGES.map((key) => {
          const def = STAGE_REGISTRY[key];
          const active = currentMode === key;
          const label = def.navLabel;
          const title = def.hotkey ? `${label} (${def.hotkey})` : label;
          return (
            <button
              key={key}
              type="button"
              className={`ct-rail-action${active ? " accent" : ""}`}
              title={title}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              onClick={() => setMode(idlePayload(key as StageMode))}
            >
              <StageIcon mode={key as StageMode} />
            </button>
          );
        })}

        {/* Commandeur ⌘K */}
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
      </div>

      {/* Divider */}
      <div className="ct-rail-divider" />

      {/* Groupe PAGES */}
      <div className="ct-rail-actions">
        {RAIL_PAGES.map((page) => {
          const { key, href, label } = page;
          const external = "external" in page && page.external;
          // Lien cross-domaine vers une autre app Hearst → nouvel onglet, jamais "active".
          if (external) {
            return (
              <a
                key={key}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="ct-rail-action"
                title={`${label} ↗`}
                aria-label={`${label} (ouvre dans un nouvel onglet)`}
              >
                <PageIcon page={key} />
              </a>
            );
          }
          const active = pathname?.startsWith(href) ?? false;
          return (
            <Link
              key={key}
              href={href}
              className={`ct-rail-action${active ? " accent" : ""}`}
              title={label}
              aria-label={label}
              aria-current={active ? "page" : undefined}
            >
              <PageIcon page={key} />
            </Link>
          );
        })}
      </div>

      <div className="ct-spacer" />

      {/* Bottom */}
      <div className="ct-rail-bottom">
        {/* Connexions */}
        <button
          type="button"
          className={`ct-rail-badge${currentMode === "connections" ? " accent" : ""}`}
          title="Connexions"
          aria-label="Connexions et services"
          aria-current={currentMode === "connections" ? "page" : undefined}
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

        {/* Settings → lien page /settings */}
        <Link
          href="/settings"
          className={`ct-rail-settings${pathname?.startsWith("/settings") ? " accent" : ""}`}
          title="Réglages"
          aria-label="Réglages"
          aria-current={pathname?.startsWith("/settings") ? "page" : undefined}
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
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </Link>

        <UserAvatar />
      </div>
    </aside>
  );
}
