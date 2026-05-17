"use client";

/**
 * BackLink — pattern unifié de lien retour pour les pages admin.
 *
 * Extraite du pattern dupliqué `<Link><svg chevron/>label</Link>` présent dans
 * plusieurs pages admin (agents/[id], orchestrator/runs/[id], agent-driven-dev*).
 *
 * Choix de design (2026-05-17, it.3 H1) :
 *   - `font-light` est conservé : on retrouve déjà `t-12 font-light` ailleurs dans admin
 *     (cf. AdminSidebar.tsx ligne ~157 sur le bouton "déconnexion"). Le poids `font-light`
 *     est cohérent avec les microcopies admin et aère le lien retour.
 *   - Focus-visible explicite (a11y) aligné sur les patterns d'inputs admin :
 *     bord teal + soulignement, pas de outline native.
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
      className="inline-flex items-center gap-(--space-2) t-12 font-light text-text-muted hover:text-text focus-visible:outline-none focus-visible:text-text focus-visible:underline focus-visible:decoration-(--accent-teal) transition-colors"
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
