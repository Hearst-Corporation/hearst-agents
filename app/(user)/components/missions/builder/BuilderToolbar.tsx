"use client";

/**
 * BuilderToolbar — actions du Builder, hiérarchie Apple HIG.
 * - Primary  : Sauvegarder (filled accent-teal)
 * - Secondary: Valider, Preview (ghost)
 * - Tertiary : Templates, Publier marketplace (overflow menu "…")
 *
 * Handlers :
 * - onOpenTemplates : ouvre la liste des graphes prédéfinis
 * - onValidate      : checke le graphe + affiche erreurs (badge count)
 * - onPreview       : lance un dry-run via /api/v2/workflows/preview
 * - onSave          : POST /api/v2/missions avec workflowGraph
 * - onPublish       : publie vers le marketplace (optionnel)
 */

import { useEffect, useRef, useState, type ReactNode } from "react";

interface BuilderToolbarProps {
  onOpenTemplates: () => void;
  onValidate: () => void;
  onPreview: () => void;
  onSave: () => void;
  onPublish?: () => void;
  isBusy?: boolean;
  saveLabel?: string;
  validationCount?: number;
  previewSummary?: string | null;
}

export function BuilderToolbar({
  onOpenTemplates,
  onValidate,
  onPreview,
  onSave,
  onPublish,
  isBusy,
  saveLabel = "Sauvegarder",
  validationCount,
  previewSummary,
}: BuilderToolbarProps) {
  const hasErrors = typeof validationCount === "number" && validationCount > 0;

  return (
    <div
      className="flex items-center justify-between border-b border-(--border-shell)"
      style={{
        padding: "var(--space-3) var(--space-12)",
        gap: "var(--space-4)",
        background: "var(--rail)",
      }}
    >
      {/* Secondary actions */}
      <div className="flex items-center" style={{ gap: "var(--space-2)" }}>
        <GhostButton onClick={onValidate}>
          Valider
          {hasErrors && (
            <span
              className="t-9 font-mono"
              style={{ color: "var(--danger)", marginLeft: "var(--space-1)" }}
            >
              ({validationCount})
            </span>
          )}
        </GhostButton>
        <GhostButton onClick={onPreview} disabled={isBusy}>
          {isBusy ? "Preview…" : "Preview"}
        </GhostButton>
      </div>

      {previewSummary && (
        <span className="t-11 text-text-muted truncate max-w-md">
          {previewSummary}
        </span>
      )}

      {/* Primary + Tertiary */}
      <div className="flex items-center" style={{ gap: "var(--space-2)" }}>
        <OverflowMenu
          items={[
            { label: "Templates", onSelect: onOpenTemplates },
            ...(onPublish
              ? [
                  {
                    label: "Publier marketplace",
                    onSelect: onPublish,
                    disabled: isBusy,
                  },
                ]
              : []),
          ]}
        />
        <PrimaryButton onClick={onSave} disabled={isBusy}>
          {saveLabel}
        </PrimaryButton>
      </div>
    </div>
  );
}

/* ---------- Primary (filled) ---------- */

interface PrimaryButtonProps {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}

function PrimaryButton({ onClick, disabled, children }: PrimaryButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="t-11 transition-colors disabled:opacity-40 rounded-md"
      style={{
        padding: "var(--space-2) var(--space-3)",
        color: "var(--text-on-accent-teal)",
        background: "var(--accent-teal)",
        border: "1px solid var(--accent-teal)",
        fontWeight: 500,
      }}
    >
      {children}
    </button>
  );
}

/* ---------- Secondary (ghost) ---------- */

interface GhostButtonProps {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}

function GhostButton({ onClick, disabled, children }: GhostButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="t-11 font-light transition-colors disabled:opacity-40 rounded-md"
      style={{
        padding: "var(--space-2) var(--space-3)",
        color: "var(--text-soft)",
        background: "transparent",
        border: "1px solid var(--border-soft)",
      }}
    >
      {children}
    </button>
  );
}

/* ---------- Tertiary (overflow menu) ---------- */

interface OverflowItem {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
}

interface OverflowMenuProps {
  items: OverflowItem[];
}

function OverflowMenu({ items }: OverflowMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Click outside + Escape pour fermer.
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Plus d'actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className="t-11 font-light transition-colors rounded-md"
        style={{
          padding: "var(--space-2) var(--space-3)",
          color: "var(--text-soft)",
          background: "transparent",
          border: "1px solid var(--border-soft)",
        }}
      >
        …
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 flex flex-col"
          style={{
            top: "calc(100% + var(--space-1))",
            minWidth: "var(--space-48)",
            background: "var(--rail)",
            border: "1px solid var(--border-shell)",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-1)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                if (item.disabled) return;
                item.onSelect();
                setOpen(false);
              }}
              className="t-11 font-light text-left transition-colors disabled:opacity-40 rounded-sm hover:bg-[var(--accent-teal-bg-hover)]"
              style={{
                padding: "var(--space-2) var(--space-3)",
                color: "var(--text-soft)",
                background: "transparent",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
