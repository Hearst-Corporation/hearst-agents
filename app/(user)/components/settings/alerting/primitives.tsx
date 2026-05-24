"use client";

/**
 * Primitives UI internes à `AlertingSettings`.
 * Tokens design system uniquement.
 */

import type { ReactNode } from "react";
import { Action } from "@/app/(user)/components/ui/Action";
import { FormInput } from "@/app/(user)/components/ui/FormField";
import { SIGNAL_SEVERITY } from "./constants";
import type { TestState } from "./types";

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="t-13 font-medium mb-4 text-text-l1">{children}</h3>;
}

export function Input({
  value,
  onChange,
  onBlur,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <FormInput
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
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
          padding: "var(--space-0-5)",
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
  const tone = variant === "primary" ? "brand" : variant === "danger" ? "danger" : "neutral";
  const actionVariant =
    variant === "primary" ? "primary" : variant === "ghost" ? "ghost" : "secondary";

  return (
    <Action
      variant={actionVariant}
      tone={tone}
      size="md"
      onClick={onClick}
      disabled={disabled}
      className="h-auto px-(--space-3) py-(--space-1) t-13 tracking-(--tracking-caption) rounded-(--radius-sm)"
    >
      {children}
    </Action>
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
