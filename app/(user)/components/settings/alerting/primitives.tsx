"use client";

/**
 * Primitives UI internes à `AlertingSettings`.
 * Tokens design system uniquement.
 */

import type { ReactNode } from "react";
import { SIGNAL_SEVERITY } from "./constants";
import type { TestState } from "./types";

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="t-13 font-medium mb-4" style={{ color: "var(--text-l1)" }}>
      {children}
    </h3>
  );
}

export function Input({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full t-13"
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-sm)",
        padding: "var(--space-2) var(--space-3)",
        color: "var(--text)",
        outline: "none",
        transition: `border-color var(--duration-base) var(--ease-standard), box-shadow var(--duration-base) var(--ease-standard)`,
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = "var(--accent-teal)";
        e.currentTarget.style.boxShadow = "var(--shadow-input-focus)";
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = "var(--border-default)";
        e.currentTarget.style.boxShadow = "none";
      }}
    />
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 t-13"
      style={{
        color: "var(--text-soft)",
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: 0,
      }}
    >
      <span
        style={{
          display: "inline-flex",
          width: "var(--space-8)",
          height: "var(--space-4)",
          borderRadius: "var(--radius-pill)",
          background: checked ? "var(--accent-teal)" : "var(--surface-2)",
          border: `1px solid ${checked ? "var(--accent-teal)" : "var(--border-default)"}`,
          alignItems: "center",
          padding: "2px",
          transition: `background var(--duration-base) var(--ease-standard)`,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            width: "calc(var(--space-4) - 6px)",
            height: "calc(var(--space-4) - 6px)",
            borderRadius: "var(--radius-pill)",
            background: "var(--text)",
            transform: checked ? "translateX(calc(var(--space-4) - 2px))" : "translateX(0)",
            transition: `transform var(--duration-base) var(--ease-spring)`,
          }}
        />
      </span>
      <span>{label}</span>
    </button>
  );
}

export function Btn({
  children,
  onClick,
  variant = "default",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "default" | "danger" | "primary" | "ghost";
  disabled?: boolean;
}) {
  const colors = {
    default: { bg: "var(--surface-2)", color: "var(--text-soft)", border: "var(--border-default)" },
    danger: {
      bg: "var(--color-error-bg)",
      color: "var(--color-error)",
      border: "var(--color-error-border)",
    },
    primary: {
      bg: "var(--accent-teal)",
      color: "var(--text-on-accent-teal)",
      border: "transparent",
    },
    ghost: { bg: "transparent", color: "var(--text-muted)", border: "transparent" },
  };
  const c = colors[variant];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="t-13"
      style={{
        background: c.bg,
        color: c.color,
        border: `1px solid ${c.border}`,
        borderRadius: "var(--radius-sm)",
        padding: "var(--space-1) var(--space-3)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: `opacity var(--duration-fast) var(--ease-standard)`,
        letterSpacing: "var(--tracking-caption)",
      }}
    >
      {children}
    </button>
  );
}

export function TestBadge({ state, message }: { state?: TestState; message?: string }) {
  if (!state || state === "testing") {
    return state === "testing" ? (
      <span
        className="t-9"
        style={{ color: "var(--text-faint)", letterSpacing: "var(--tracking-caption)" }}
      >
        Test en cours…
      </span>
    ) : null;
  }
  return (
    <span
      className="t-9"
      style={{
        color: state === "ok" ? "var(--color-success)" : "var(--color-error)",
        letterSpacing: "var(--tracking-caption)",
      }}
      title={message}
    >
      {state === "ok" ? "Connecté" : `Erreur${message ? `: ${message}` : ""}`}
    </span>
  );
}

export function SignalBadge({ type }: { type: keyof typeof SIGNAL_SEVERITY | "*" }) {
  if (type === "*") {
    return (
      <span
        className="t-9"
        style={{
          background: "var(--accent-teal-surface)",
          color: "var(--accent-teal)",
          border: "1px solid var(--accent-teal-border)",
          borderRadius: "var(--radius-xs)",
          padding: "1px var(--space-1)",
          letterSpacing: "var(--tracking-caption)",
        }}
      >
        Tous
      </span>
    );
  }
  const sev = SIGNAL_SEVERITY[type as keyof typeof SIGNAL_SEVERITY];
  const colors = {
    critical: {
      bg: "var(--color-error-bg)",
      color: "var(--color-error)",
      border: "var(--color-error-border)",
    },
    warning: {
      bg: "var(--color-warning-bg)",
      color: "var(--color-warning)",
      border: "var(--color-warning-border)",
    },
    info: {
      bg: "var(--color-info-bg)",
      color: "var(--color-info)",
      border: "var(--color-info-border)",
    },
  };
  const c = colors[sev ?? "info"];
  return (
    <span
      className="t-9"
      style={{
        background: c.bg,
        color: c.color,
        border: `1px solid ${c.border}`,
        borderRadius: "var(--radius-xs)",
        padding: "1px var(--space-1)",
        letterSpacing: "var(--tracking-caption)",
      }}
    >
      {type}
    </span>
  );
}
