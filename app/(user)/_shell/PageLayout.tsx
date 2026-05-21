"use client";

/**
 * PageLayout — layout commun pour toutes les pages (style ct-page-area).
 *
 * Fournit :
 *   - .ct-eyebrow (cyan #2ecFC2)
 *   - .ct-title
 *   - .ct-sub
 *   - .ct-card (composant CtCard)
 *   - Grande marge à droite pour le chat
 */

import { ReactNode } from "react";

// ── Styles communs ───────────────────────────────────────────────────────────

export const PAGE_AREA_STYLE: React.CSSProperties = {
  width: "100%",
  maxWidth: "var(--width-cockpit-max)",
  marginInline: "auto",
  padding: "var(--space-6) var(--space-6) var(--space-20)",
};

export const EYEBROW_STYLE: React.CSSProperties = {
  fontSize: "var(--font-size-11, 11px)",
  fontWeight: "var(--weight-semibold)" as unknown as number,
  textTransform: "uppercase",
  letterSpacing: "var(--tracking-caption)",
  color: "var(--accent-teal)",
  marginBottom: "var(--space-2)",
  fontFamily: "var(--font-satoshi)",
};

export const TITLE_STYLE: React.CSSProperties = {
  fontSize: "var(--font-size-24, 24px)",
  fontWeight: "var(--weight-semibold)" as unknown as number,
  color: "var(--text)",
  marginBottom: "var(--space-1)",
  lineHeight: "var(--line-height-tight, 1.2)",
  fontFamily: "var(--font-satoshi)",
  letterSpacing: "var(--tracking-tight)",
};

export const SUB_STYLE: React.CSSProperties = {
  fontSize: "var(--font-size-13, 13px)",
  color: "var(--text-muted)",
  marginBottom: "var(--space-4)",
  fontFamily: "var(--font-satoshi)",
  letterSpacing: "-0.01em",
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
      <div className="ct-eyebrow" style={EYEBROW_STYLE}>
        {eyebrow}
      </div>
      <h1 className="ct-title" style={TITLE_STYLE}>
        {title}
      </h1>
      {subtitle && (
        <p className="ct-sub" style={SUB_STYLE}>
          {subtitle}
        </p>
      )}
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
