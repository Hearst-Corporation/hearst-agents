// lint-visual-disable-file — prototype luxe orbital, palette ad-hoc hors DS
"use client";

import { useState } from "react";

export interface ServiceNode {
  id: string;
  icon: React.ReactNode;
  label: string;
  subInfo: string | null;
  connected: boolean;
}

interface OrbitalNodeProps {
  node: ServiceNode;
  style?: React.CSSProperties;
}

export function OrbitalNode({ node, style }: OrbitalNodeProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...style,
        width: 108,
        height: 80,
        borderRadius: 16,
        background: hovered ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.035)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: `1px solid ${hovered ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.09)"}`,
        boxShadow: hovered
          ? "0 12px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.16), 0 0 24px rgba(74,139,134,0.12)"
          : "0 8px 28px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
        cursor: "default",
        transition: "all 0.25s ease",
        transform: hovered ? "translateY(-3px)" : "translateY(0)",
        userSelect: "none",
      }}
    >
      {/* Dot de connexion */}
      <div style={{ position: "absolute", top: 8, right: 8, width: 5, height: 5 }}>
        <div style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: node.connected ? "rgba(74,139,134,0.9)" : "rgba(255,255,255,0.2)",
          boxShadow: node.connected ? "0 0 6px rgba(74,139,134,0.8)" : "none",
        }} />
      </div>

      <div style={{ width: 22, height: 22, color: "rgba(255,255,255,0.75)", flexShrink: 0 }}>
        {node.icon}
      </div>
      <span style={{ fontSize: 11, fontWeight: 300, color: "rgba(255,255,255,0.85)", letterSpacing: "0.01em", textAlign: "center", lineHeight: 1.2 }}>
        {node.label}
      </span>
      {node.subInfo && (
        <span style={{ fontSize: 10, fontWeight: 300, color: "rgba(255,255,255,0.38)", textAlign: "center" }}>
          {node.subInfo}
        </span>
      )}
    </div>
  );
}
