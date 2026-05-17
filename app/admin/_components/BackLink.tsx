"use client";

/**
 * BackLink — primitive de retour navigation interne pour l'admin.
 *
 * Extraite du pattern dupliqué `<Link><svg chevron/>label</Link>` présent dans
 * plusieurs pages admin (`agent-driven-dev/[id]`, etc.). Garde la classe
 * `inline-flex` + chevron SVG inline pour rester cohérent avec le style admin
 * (pas d'icône lourde, tokens uniquement).
 */

import Link from "next/link";

interface BackLinkProps {
  href: string;
  label: string;
}

export function BackLink({ href, label }: BackLinkProps) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-(--space-2) t-12 font-light text-text-muted hover:text-text transition-colors"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="15 18 9 12 15 6" />
      </svg>
      <span>{label}</span>
    </Link>
  );
}
