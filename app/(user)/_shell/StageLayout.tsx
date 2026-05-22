"use client";

import { ReactNode } from "react";
import { PAGE_AREA_STYLE } from "./PageLayout";

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
          }}
        >
          <div>
            <div className="ct-eyebrow">{eyebrow}</div>
            <h1 className="ct-title">{title}</h1>
          </div>
          {actions && <div style={{ flexShrink: 0, paddingTop: "var(--space-1)" }}>{actions}</div>}
        </div>
        {subtitle && <p className="ct-sub">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
