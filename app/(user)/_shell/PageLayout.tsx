"use client";

/**
 * PageLayout — layout commun pour les pages (conteneur .ct-page-area).
 *
 * Les en-têtes (eyebrow / titre / sous-titre) sont rendus via les classes
 * canon `.ct-eyebrow` / `.ct-title` / `.ct-sub` définies dans globals.css
 * (source unique partagée avec StageLayout et PageHeader). Ici on n'expose
 * plus que les styles de conteneur/carte qui n'ont pas d'équivalent classe.
 */

import { ReactNode } from "react";

// ── Styles communs ───────────────────────────────────────────────────────────

export const PAGE_AREA_STYLE: React.CSSProperties = {
  width: "100%",
  maxWidth: "var(--width-cockpit-max)",
  marginInline: "auto",
  paddingInline: "var(--space-6)",
};

export const CARD_STYLE: React.CSSProperties = {
  background: "var(--surface-1)",
  border: "1px solid var(--border-shell)",
  borderRadius: "var(--radius-md)",
  overflow: "hidden",
  marginBottom: "var(--space-3)",
};

export const CARD_TITLE_STYLE: React.CSSProperties = {
  fontSize: "var(--font-size-11, 11px)",
  fontWeight: "var(--weight-semibold)" as unknown as number,
  color: "var(--text-soft)",
  padding: "var(--space-4) var(--space-5) 0",
  textTransform: "uppercase",
  letterSpacing: "var(--tracking-caption)",
  fontFamily: "var(--font-satoshi)",
};

export const CARD_BODY_STYLE: React.CSSProperties = {
  padding: "var(--space-3) var(--space-4) var(--space-4)",
};

// ── Composants ───────────────────────────────────────────────────────────────

interface PageLayoutProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function PageLayout({ eyebrow = "Cockpit", title, subtitle, children }: PageLayoutProps) {
  return (
    <div style={PAGE_AREA_STYLE}>
      <div className="ct-eyebrow">{eyebrow}</div>
      <h1 className="ct-title">{title}</h1>
      {subtitle && <p className="ct-sub">{subtitle}</p>}
      {children}
    </div>
  );
}

interface CardProps {
  title?: string;
  children: ReactNode;
  style?: React.CSSProperties;
}

export function CtCard({ title, children, style }: CardProps) {
  return (
    <div className="ct-card" style={{ ...CARD_STYLE, ...style }}>
      {title && (
        <div className="ct-card-title" style={CARD_TITLE_STYLE}>
          {title}
        </div>
      )}
      <div className="ct-card-body" style={CARD_BODY_STYLE}>
        {children}
      </div>
    </div>
  );
}
