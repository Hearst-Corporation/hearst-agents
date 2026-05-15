"use client";

/**
 * VideoBatchForm — mode batch (Q3-A) du VideoQuickLaunch.
 *
 * Tant qu'on n'a pas lancé, on affiche les sous-forms éditables
 * (`VideoBatchVariantField`). Quand running/done/error, on délègue à
 * `VideoBatchGrid` qui affiche les progress cards.
 */

import { SegmentedInline } from "./segments";
import {
  type BatchPhase,
  type BatchVariantForm,
  type BatchVariantRun,
  type DurationOption,
  MAX_BATCH_VARIANTS,
  type Provider,
  RATIO_LABELS,
  type RatioOption,
} from "./types";
import { VideoBatchGrid } from "./VideoBatchGrid";

export function VideoBatchForm({
  forms,
  updateForm,
  addForm,
  removeForm,
  isBusy,
  runs,
  batchPhase,
  batchError,
}: {
  forms: BatchVariantForm[];
  updateForm: (localId: string, patch: Partial<BatchVariantForm>) => void;
  addForm: () => void;
  removeForm: (localId: string) => void;
  isBusy: boolean;
  runs: BatchVariantRun[];
  batchPhase: BatchPhase;
  batchError: string | null;
}) {
  // Tant qu'on n'a pas lancé, on affiche les forms éditables. Quand running/
  // done/error, on switch sur la grille de progress cards.
  const showRuns = batchPhase === "creating" || batchPhase === "running" || batchPhase === "done";

  if (showRuns) {
    return <VideoBatchGrid runs={runs} batchError={batchError} />;
  }

  return (
    <>
      {batchError && (
        <div
          style={{
            padding: "var(--space-3) var(--space-4)",
            borderLeft: "2px solid var(--danger)",
            background: "var(--card-flat-bg)",
          }}
        >
          <p className="t-11 font-medium text-(--danger)">{batchError}</p>
        </div>
      )}
      {forms.map((form, i) => (
        <VideoBatchVariantField
          key={form.localId}
          index={i}
          form={form}
          canRemove={forms.length > 1}
          onChange={(patch) => updateForm(form.localId, patch)}
          onRemove={() => removeForm(form.localId)}
          disabled={isBusy}
        />
      ))}
      {forms.length < MAX_BATCH_VARIANTS && (
        <button
          type="button"
          onClick={addForm}
          disabled={isBusy}
          className="t-11 font-light text-text-muted hover:text-(--accent-teal) border border-dashed border-(--border-shell) hover:border-(--accent-teal) transition-colors disabled:opacity-50"
          style={{
            padding: "var(--space-3)",
            borderRadius: "var(--radius-sm)",
          }}
        >
          + Ajouter une variante
        </button>
      )}
    </>
  );
}

function VideoBatchVariantField({
  index,
  form,
  canRemove,
  onChange,
  onRemove,
  disabled,
}: {
  index: number;
  form: BatchVariantForm;
  canRemove: boolean;
  onChange: (patch: Partial<BatchVariantForm>) => void;
  onRemove: () => void;
  disabled: boolean;
}) {
  return (
    <div
      className="flex flex-col"
      style={{
        gap: "var(--space-3)",
        padding: "var(--space-4)",
        background: "var(--card-flat-bg)",
        border: "1px solid var(--border-shell)",
        borderRadius: "var(--radius-sm)",
      }}
    >
      <div className="flex items-center justify-between">
        <span className="t-11 font-medium text-(--accent-teal)">Variant {index + 1}</span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            className="t-11 font-light text-text-muted hover:text-(--danger) transition-colors disabled:opacity-50"
            aria-label={`Retirer le variant ${index + 1}`}
          >
            Retirer
          </button>
        )}
      </div>

      <textarea
        value={form.prompt}
        onChange={(e) => onChange({ prompt: e.target.value })}
        disabled={disabled}
        placeholder={`Prompt du variant ${index + 1}…`}
        rows={3}
        className="t-13 font-light text-text bg-[var(--surface-1)] border border-(--border-shell) hover:border-[var(--accent-teal-border-hover)] focus:border-[var(--accent-teal-border-hover)] focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed resize-none"
        style={{ padding: "var(--space-3)", borderRadius: "var(--radius-sm)" }}
      />

      <div className="flex" style={{ gap: "var(--space-2)" }}>
        <SegmentedInline<Provider>
          options={["runway", "heygen"]}
          getLabel={(p) => (p === "runway" ? "Runway" : "HeyGen")}
          value={form.provider}
          onChange={(provider) => onChange({ provider })}
          disabled={disabled}
        />
        <SegmentedInline<DurationOption>
          options={[5, 10]}
          getLabel={(d) => `${d}s`}
          value={form.duration}
          onChange={(duration) => onChange({ duration })}
          disabled={disabled}
        />
      </div>

      {form.provider === "runway" && (
        <SegmentedInline<RatioOption>
          options={["1280:720", "720:1280"]}
          getLabel={(r) => RATIO_LABELS[r]}
          value={form.ratio}
          onChange={(ratio) => onChange({ ratio })}
          disabled={disabled}
        />
      )}
    </div>
  );
}
