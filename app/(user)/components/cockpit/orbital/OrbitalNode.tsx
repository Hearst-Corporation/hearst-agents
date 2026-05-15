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
}

export function OrbitalNode({ node }: OrbitalNodeProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`relative flex flex-col items-center justify-center gap-1 p-2 rounded-lg cursor-pointer select-none transition-all duration-base ease-standard
        ${hovered ? "bg-surface-2 border-border-strong scale-[1.03] shadow-card-deep glow-subtle-accent" : "bg-surface-1 border-border-soft"}
        ${node.connected ? "animate-[pulse-breath_2s_ease-in-out_infinite]" : ""}
      `}
      style={{ width: 110, height: 80 }}
    >
      {/* Dot de connexion */}
      <div
        className={`absolute top-2 right-2 w-1.5 h-1.5 rounded-full transition-all duration-base ease-standard
          ${node.connected ? "bg-accent-teal shadow-pulse-dot-md" : "bg-danger opacity-60"}
        `}
      />

      {/* Icône */}
      <div
        className={`w-4 h-4 shrink-0 transition-all duration-base ease-standard
          ${hovered ? "text-text-l0 scale-110" : "text-text-l2"}
        `}
      >
        {node.icon}
      </div>

      {/* Label */}
      <span
        className={`t-11 font-light text-center leading-tight transition-colors duration-base ease-standard
          ${hovered ? "text-text-l0" : "text-text-l2"}
        `}
      >
        {node.label}
      </span>

      {/* SubInfo */}
      {node.subInfo && (
        <span className="font-mono t-9 font-light text-center tracking-subtle text-text-l3">
          {node.subInfo}
        </span>
      )}
    </div>
  );
}
