"use client";

import { useState } from "react";
import { z } from "zod";
import { Action, ModalShell } from "../ui";
import { FieldError, ValidatedForm } from "../ui/ValidatedForm";

interface ExtractSchemaModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: { instruction: string; schema?: Record<string, unknown> }) => void;
  loading?: boolean;
}

const DEFAULT_SCHEMA = `{
  "title": "string",
  "price": "number"
}`;

const extractFormSchema = z.object({
  instruction: z.string().min(1, "Décris ce que l'agent doit extraire."),
  schema: z.string().optional(),
});

export function ExtractSchemaModal({ open, onClose, onSubmit, loading }: ExtractSchemaModalProps) {
  const [instruction, setInstruction] = useState("");
  const [schemaText, setSchemaText] = useState(DEFAULT_SCHEMA);
  const [jsonError, setJsonError] = useState<string | null>(null);

  if (!open) return null;

  const handleValid = ({
    instruction: instr,
    schema: schemaStr,
  }: {
    instruction: string;
    schema?: string;
  }) => {
    setJsonError(null);
    let schema: Record<string, unknown> | undefined;
    if (schemaStr?.trim()) {
      try {
        const parsed = JSON.parse(schemaStr) as unknown;
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
          throw new Error("Le schema doit être un objet JSON.");
        }
        schema = parsed as Record<string, unknown>;
      } catch (e) {
        setJsonError(e instanceof Error ? e.message : "Schema JSON invalide");
        return;
      }
    }
    onSubmit({ instruction: instr.trim(), schema });
  };

  return (
    <ModalShell open={open} onClose={onClose} className="px-4" a11yOptions={{ onClose: onClose }}>
      <div
        aria-label="Extraction structurée"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl flex flex-col gap-4 p-6 rounded-md border border-(--border-default)"
        style={{ background: "var(--bg-elev)" }}
      >
        <div className="flex items-center justify-between">
          <span className="t-11 font-light text-text-faint">EXTRACT</span>
          <button
            type="button"
            onClick={onClose}
            className="t-13 text-text-muted hover:text-text"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        <p className="t-15 text-text" style={{ lineHeight: "var(--leading-snug)" }}>
          Décris ce que l{"'"}agent doit extraire de la page courante.
        </p>

        <ValidatedForm schema={extractFormSchema} onValid={handleValid}>
          {({ errors, submitting, handleSubmit }) => (
            <>
              <label className="flex flex-col gap-2">
                <span className="t-11 font-light text-text-faint">INSTRUCTION</span>
                <textarea
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  placeholder="ex: extrais le titre et le prix du produit affiché"
                  rows={2}
                  className="w-full p-3 rounded-md border border-(--border-input) t-13 text-text font-mono"
                  style={{ background: "var(--bg-soft)" }}
                  disabled={loading || submitting}
                />
                <FieldError name="instruction" errors={errors} />
              </label>

              <label className="flex flex-col gap-2">
                <span className="t-11 font-light text-text-faint">SCHEMA (JSON)</span>
                <textarea
                  value={schemaText}
                  onChange={(e) => setSchemaText(e.target.value)}
                  rows={8}
                  className="w-full p-3 rounded-md border border-(--border-input) t-13 text-text font-mono"
                  style={{ background: "var(--bg-soft)" }}
                  disabled={loading || submitting}
                  spellCheck={false}
                />
              </label>

              {jsonError && <p className="t-11 font-medium text-(--danger)">{jsonError}</p>}

              <div className="flex justify-end" style={{ gap: "var(--space-2)" }}>
                <Action
                  variant="ghost"
                  tone="neutral"
                  size="sm"
                  onClick={onClose}
                  disabled={loading || submitting}
                >
                  Annuler
                </Action>
                <Action
                  variant="primary"
                  tone="brand"
                  size="sm"
                  onClick={() => void handleSubmit({ instruction, schema: schemaText })}
                  loading={loading || submitting}
                >
                  Extraire
                </Action>
              </div>
            </>
          )}
        </ValidatedForm>
      </div>
    </ModalShell>
  );
}
