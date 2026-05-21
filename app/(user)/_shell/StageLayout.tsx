"use client";

import { ReactNode } from "react";
import { EYEBROW_STYLE, PAGE_AREA_STYLE, SUB_STYLE, TITLE_STYLE } from "./PageLayout";

interface StageLayoutProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function StageLayout({ eyebrow, title, subtitle, actions, children }: StageLayoutProps) {
  return (
    <div style={PAGE_AREA_STYLE}>
      <div style={{ marginBottom: "var(--space-6)" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "var(--space-4)",
            marginBottom: subtitle ? "var(--space-1)" : "0",
          }}
        >
          <div>
            <div className="ct-eyebrow" style={EYEBROW_STYLE}>
              {eyebrow}
            </div>
            <h1 className="ct-title" style={TITLE_STYLE}>
              {title}
            </h1>
          </div>
          {actions && <div style={{ flexShrink: 0, paddingTop: "var(--space-1)" }}>{actions}</div>}
        </div>
        {subtitle && (
          <p className="ct-sub" style={SUB_STYLE}>
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}
