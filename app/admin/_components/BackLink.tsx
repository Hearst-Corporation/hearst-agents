import Link from "next/link";

interface BackLinkProps {
  href: string;
  label: string;
}

/**
 * BackLink — pattern unifié de lien retour pour les pages admin.
 *
 * Choix de design (2026-05-17, it.3 H1) :
 *   - `font-light` est conservé : on retrouve déjà `t-12 font-light` ailleurs dans admin
 *     (cf. AdminSidebar.tsx ligne ~157 sur le bouton "déconnexion"). Le poids `font-light`
 *     est cohérent avec les microcopies admin et aère le lien retour.
 *   - Focus-visible explicite (a11y) aligné sur les patterns d'inputs admin :
 *     bord teal + soulignement, pas de outline native.
 */
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
        aria-hidden="true"
      >
        <path d="M15 18l-6-6 6-6" />
      </svg>
      {label}
    </Link>
  );
}
