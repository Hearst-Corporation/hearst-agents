"use client";

import Link from "next/link";

export interface Crumb {
  label: string;
  href?: string;
  accent?: boolean;
}

interface BreadcrumbProps {
  trail: Crumb[];
  className?: string;
}

export function Breadcrumb({ trail, className }: BreadcrumbProps) {
  // Apple-grade : on évite la racine "Hearst" redondante avec le wordmark
  // de la TimelineRail. Le breadcrumb part directement à la section.
  // Filtre transparent côté composant — aucun caller à modifier.
  const filtered = trail.filter((crumb) => crumb.label !== "Hearst");

  if (filtered.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center gap-2 t-11 font-light ${className ?? ""}`}
    >
      {filtered.map((crumb, idx) => {
        const isLast = idx === filtered.length - 1;
        const baseClass = isLast
          ? `${crumb.accent ? "text-(--accent-teal)" : "text-text"}`
          : "text-text-faint hover:text-text transition-colors";
        return (
          <span key={`${crumb.label}-${idx}`} className="flex items-center gap-2">
            {crumb.href && !isLast ? (
              <Link href={crumb.href} className={baseClass}>
                {crumb.label}
              </Link>
            ) : (
              <span className={baseClass}>{crumb.label}</span>
            )}
            {!isLast && (
              <span className="text-text-ghost" aria-hidden>
                ›
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
