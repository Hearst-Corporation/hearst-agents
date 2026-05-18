import Link from "next/link";

/**
 * 404 global — page introuvable. Design calqué sur app/(user)/error.tsx
 * (centré, tokens, voix sobre). Rendu dans le layout racine.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="t-13 text-text-muted">Cette page n&apos;existe pas ou a été déplacée.</p>
      <Link
        href="/"
        className="t-12 rounded-(--radius-sm) border border-(--border-shell) px-(--space-4) py-(--space-2) text-text-muted hover:text-text transition-colors"
      >
        Retour au cockpit
      </Link>
    </div>
  );
}
