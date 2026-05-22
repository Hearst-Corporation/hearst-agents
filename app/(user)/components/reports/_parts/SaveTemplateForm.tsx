"use client";

import type { RefObject } from "react";
import { Action } from "@/app/(user)/components/ui";

interface SaveTemplateFormProps {
  saveName: string;
  saveDesc: string;
  isSaving: boolean;
  saveNameRef: RefObject<HTMLInputElement | null>;
  onChangeName: (v: string) => void;
  onChangeDesc: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function SaveTemplateForm({
  saveName,
  saveDesc,
  isSaving,
  saveNameRef,
  onChangeName,
  onChangeDesc,
  onConfirm,
  onCancel,
}: SaveTemplateFormProps) {
  return (
    <div
      data-testid="report-editor-save-form"
      className="flex flex-col"
      style={{
        gap: "var(--space-2)",
        padding: "var(--space-3)",
        background: "var(--surface-1)",
        border: "1px solid var(--surface-2)",
        borderRadius: "var(--radius-xs)",
      }}
    >
      <span className="t-9 font-mono uppercase text-text-muted">Nom du template</span>
      <input
        ref={saveNameRef}
        type="text"
        value={saveName}
        onChange={(e) => onChangeName(e.target.value)}
        placeholder="Mon template…"
        data-testid="report-editor-save-name"
        maxLength={100}
        className="t-11 text-text"
        style={{
          padding: "var(--space-2) var(--space-3)",
          background: "var(--card-flat-bg)",
          border: "1px solid var(--surface-2)",
          borderRadius: "var(--radius-xs)",
          outline: "none",
        }}
      />
      <input
        type="text"
        value={saveDesc}
        onChange={(e) => onChangeDesc(e.target.value)}
        placeholder="Description optionnelle…"
        data-testid="report-editor-save-desc"
        maxLength={500}
        className="t-11 text-text-soft"
        style={{
          padding: "var(--space-2) var(--space-3)",
          background: "var(--card-flat-bg)",
          border: "1px solid var(--surface-2)",
          borderRadius: "var(--radius-xs)",
          outline: "none",
        }}
      />
      <div className="flex items-center" style={{ gap: "var(--space-2)" }}>
        <Action
          variant="primary"
          tone="brand"
          size="sm"
          onClick={onConfirm}
          disabled={!saveName.trim() || isSaving}
          loading={isSaving}
          testId="report-editor-save-confirm"
        >
          {isSaving ? "Sauvegarde…" : "Confirmer"}
        </Action>
        <Action
          variant="secondary"
          tone="neutral"
          size="sm"
          onClick={onCancel}
          testId="report-editor-save-cancel"
        >
          Annuler
        </Action>
      </div>
    </div>
  );
}
