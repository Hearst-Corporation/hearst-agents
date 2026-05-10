/**
 * GhostFooterLink — lien minimaliste du footer (Admin / Exit).
 *
 * Bascule entre <Link> (si href) et <button> (si onClick). Couleur
 * text-faint au repos, teal au hover. Pas de halo-on-hover.
 */

import Link from "next/link";
import { useState } from "react";
import type { ReactNode } from "react";

export interface GhostFooterLinkProps {
  href?: string;
  onClick?: () => void;
  title: string;
  children: ReactNode;
}

export function GhostFooterLink({ href, onClick, title, children }: GhostFooterLinkProps) {
  const [hover, setHover] = useState(false);
  const linkStyle = {
    color: hover ? "var(--accent-teal)" : "var(--text-faint)",
  };
  const linkClass = "t-11 font-light transition-colors duration-emphasis ease-out-soft";

  if (href) {
    return (
      <Link
        href={href}
        title={title}
        className={linkClass}
        style={linkStyle}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        {children}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={linkClass}
      style={linkStyle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {children}
    </button>
  );
}
