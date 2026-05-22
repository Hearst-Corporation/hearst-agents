"use client";

/**
 * PageHeader — header standardisé pour les pages standalone.
 *
 * Source unique pour les <h1> de toutes les pages /reports, /missions,
 * /runs, /assets, /apps, /archive, /notifications, /settings/* et leurs
 * deep-links. Visuel cohérent : t-28 font-light + tracking-tight, optionnel
 * subtitle, breadcrumb, slot actions à droite, ou CTA "back" côté gauche.
 *
 * Tokens uniquement (CLAUDE.md §1).
 */

import Link from "next/link";
import type { ReactNode } from "react";
import { Breadcrumb, type Crumb } from "./Breadcrumb";
import { Action } from "./ui";

interface BackLink {
  label: string;
  /** Lien direct vers la page parente. Mutuellement exclusif avec onClick. */
  href?: string;
  /** Handler custom (ex: router.back()). Si fourni, l'élément rendu est un <button>. */
  onClick?: () => void;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumb?: Crumb[];
  actions?: ReactNode;
  back?: BackLink;
}

const ChevronLeftIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

export function PageHeader({ title, subtitle, breadcrumb, actions, back }: PageHeaderProps) {
  return (
    <header className="flex flex-col px-12 py-6" style={{ gap: "var(--space-2)" }}>
      {/* Top row : breadcrumb OU back link.
         Pivot UI 2026-05-01 : back link en typo régulière (pas mono caps
         tracking-marquee) — voix éditoriale, plus calme. PulseBar fournit déjà
         le contexte global, donc on retire la border-b qui doublait la frontière
         visuelle juste sous PulseBar 48px. */}
      {back ? (
        back.onClick ? (
          <Action
            variant="ghost"
            tone="neutral"
            size="sm"
            onClick={back.onClick}
            iconLeft={<ChevronLeftIcon />}
          >
            {back.label}
          </Action>
        ) : back.href ? (
          <Link
            href={back.href}
            className="inline-flex items-center gap-2 t-11 font-light text-text-faint hover:text-(--accent-teal) transition-colors w-fit"
          >
            <ChevronLeftIcon />
            <span>{back.label}</span>
          </Link>
        ) : null
      ) : breadcrumb && breadcrumb.length > 0 ? (
        <Breadcrumb trail={breadcrumb} />
      ) : null}

      {/* Title row */}
      <div className="flex items-start justify-between" style={{ gap: "var(--space-4)" }}>
        <div className="flex flex-col min-w-0" style={{ gap: "var(--space-2)" }}>
          <h1 className="t-28 font-medium tracking-tight text-text">{title}</h1>
          {subtitle && <p className="t-13 font-light text-text-muted">{subtitle}</p>}
        </div>
        {actions && (
          <div className="flex items-center shrink-0" style={{ gap: "var(--space-2)" }}>
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
