"use client";

import type { TemplateSummary } from "@/lib/reports/templates/schema";

interface LoadTemplateListProps {
  templateList: TemplateSummary[];
  onLoad: (templateId: string) => void;
  onCancel: () => void;
}

export function LoadTemplateList({ templateList, onLoad, onCancel }: LoadTemplateListProps) {
  return (
    <div
      data-testid="report-editor-load-list"
      className="flex flex-col"
      style={{
        gap: "var(--space-2)",
        padding: "var(--space-3)",
        background: "var(--surface-1)",
        border: "1px solid var(--surface-2)",
        borderRadius: "var(--radius-xs)",
      }}
    >
      <div className="flex items-center justify-between">
        <span className="t-9 font-mono uppercase text-text-muted">Templates disponibles</span>
        <button
          type="button"
          onClick={onCancel}
          data-testid="report-editor-load-cancel"
          className="t-9 font-mono uppercase text-text-muted hover:text-text-soft"
          style={{
            padding: "var(--space-1) var(--space-2)",
            border: "1px solid var(--surface-2)",
            borderRadius: "var(--radius-xs)",
            background: "transparent",
            transition: "color var(--duration-fast) var(--ease-standard)",
          }}
        >
          Fermer
        </button>
      </div>
      {templateList.length === 0 ? (
        <span className="t-11 text-text-faint" data-testid="report-editor-load-empty">
          Aucun template sauvegardé.
        </span>
      ) : (
        <ul className="flex flex-col" style={{ gap: "var(--space-1)" }}>
          {templateList.map((tpl) => (
            <li key={tpl.id}>
              <button
                type="button"
                onClick={() => onLoad(tpl.id)}
                data-testid={`report-editor-load-item-${tpl.id}`}
                className="w-full text-left t-11 text-text-soft hover:text-text"
                style={{
                  padding: "var(--space-2) var(--space-3)",
                  background: "transparent",
                  border: "1px solid var(--surface-2)",
                  borderRadius: "var(--radius-xs)",
                  transition: "color var(--duration-fast) var(--ease-standard)",
                }}
              >
                <span className="block truncate">{tpl.name}</span>
                {tpl.description && (
                  <span className="block truncate t-9 font-mono text-text-faint">
                    {tpl.description}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
