"use client";

import { type RefObject, useId } from "react";

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
  const nameId = useId();
  const descriptionId = useId();
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
      <label htmlFor={nameId} className="t-9 font-mono uppercase text-text-muted">
        Nom du template
      </label>
      <input
        ref={saveNameRef}
        id={nameId}
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
      <label htmlFor={descriptionId} className="sr-only">
        Description optionnelle
      </label>
      <input
        id={descriptionId}
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
        <button
          type="button"
          onClick={onConfirm}
          disabled={!saveName.trim() || isSaving}
          data-testid="report-editor-save-confirm"
          className="t-9 font-mono uppercase text-(--accent-teal) disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            padding: "var(--space-2) var(--space-3)",
            border: "1px solid var(--accent-teal)",
            borderRadius: "var(--radius-xs)",
            background: "transparent",
            transition: "opacity var(--duration-fast) var(--ease-standard)",
          }}
        >
          {isSaving ? "Sauvegarde…" : "Confirmer"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          data-testid="report-editor-save-cancel"
          className="t-9 font-mono uppercase text-text-muted hover:text-text-soft"
          style={{
            padding: "var(--space-2) var(--space-3)",
            border: "1px solid var(--surface-2)",
            borderRadius: "var(--radius-xs)",
            background: "transparent",
            transition: "color var(--duration-fast) var(--ease-standard)",
          }}
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
