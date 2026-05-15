"use client";

import { useEffect, useRef, useState } from "react";
import { useModalA11y } from "@/app/(user-legacy)/hooks/useModalA11y";
import { Action } from "./ui";

interface MissionFormData {
  name: string;
  description: string;
  prompt: string;
  frequency: "daily" | "weekly" | "monthly" | "custom";
  customCron?: string;
  enabled: boolean;
  /** Q3-D — emails approbateurs (séparés par virgule en input). */
  approvers?: string[];
  /** Q3-D — mode d'agrégation des votes. */
  approvalMode?: "all" | "any" | "majority";
}

interface MissionEditorProps {
  initialData?: Partial<MissionFormData>;
  onSave: (data: MissionFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
  /**
   * Notifie le parent dès que le formulaire devient "dirty" (premier
   * changement utilisateur après le mount). Permet au parent d'afficher
   * un dirty guard avant fermeture du drawer. Pas appelé au mount initial
   * ni à l'hydratation des `initialData`.
   */
  onDirtyChange?: (dirty: boolean) => void;
}

const FREQUENCY_OPTIONS = [
  { value: "daily", label: "Quotidien", description: "Tous les jours à 9h" },
  { value: "weekly", label: "Hebdomadaire", description: "Tous les lundis à 9h" },
  { value: "monthly", label: "Mensuel", description: "Le 1er de chaque mois" },
  { value: "custom", label: "Personnalisé", description: "Expression cron custom" },
] as const;

const APPROVAL_MODE_OPTIONS: ReadonlyArray<{
  value: "all" | "any" | "majority";
  label: string;
  description: string;
}> = [
  { value: "all", label: "Unanimité", description: "Tous doivent approuver" },
  { value: "any", label: "Un seul suffit", description: "N'importe quel vote positif lance" },
  { value: "majority", label: "Majorité", description: "Plus de la moitié doit approuver" },
];

function parseApproversInput(raw: string): string[] {
  return raw
    .split(/[,\s;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function MissionEditor({
  initialData,
  onSave,
  onCancel,
  isLoading,
  onDirtyChange,
}: MissionEditorProps) {
  const [formData, setFormData] = useState<MissionFormData>({
    name: initialData?.name || "",
    description: initialData?.description || "",
    prompt: initialData?.prompt || "",
    frequency: initialData?.frequency || "daily",
    customCron: initialData?.customCron || "",
    enabled: initialData?.enabled ?? true,
    approvers: initialData?.approvers ?? [],
    approvalMode: initialData?.approvalMode ?? "all",
  });
  const [approversRaw, setApproversRaw] = useState<string>(
    (initialData?.approvers ?? []).join(", "),
  );

  // Dirty guard — on notifie le parent une seule fois au premier changement
  // utilisateur (skip first render + skip si déjà dirty). Le parent reset
  // le flag après save réussi en remountant via `key`.
  const isFirstRender = useRef(true);
  const hasNotifiedDirty = useRef(false);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (hasNotifiedDirty.current) return;
    hasNotifiedDirty.current = true;
    onDirtyChange?.(true);
  }, [onDirtyChange]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      approvers: parseApproversInput(approversRaw),
    });
  };

  const isValid = formData.name.trim() && formData.prompt.trim();

  // Hook a11y : focus trap + scroll lock + Escape (annule, sauf en cours
  // de sauvegarde) + restore focus. Le composant n'est rendu que quand le
  // drawer parent (missions/page.tsx) est ouvert, donc isOpen=true tant
  // que monté.
  const dialogRef = useModalA11y<HTMLFormElement>(true, {
    onClose: () => {
      if (!isLoading) onCancel();
    },
  });

  return (
    <form
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mission-editor-title"
      onSubmit={handleSubmit}
      className="space-y-8"
    >
      <h2 id="mission-editor-title" className="sr-only">
        {initialData?.name ? "Modifier la mission" : "Nouvelle mission"}
      </h2>
      <div>
        <label className="ghost-meta-label block mb-2">Nom</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="ex: Rapport hebdo ventes"
          className="ghost-input-line w-full"
        />
      </div>

      <div>
        <label className="ghost-meta-label block mb-2">Description</label>
        <input
          type="text"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Objectif de cette mission..."
          className="ghost-input-line w-full"
        />
      </div>

      <div>
        <label className="ghost-meta-label block mb-2">Instructions</label>
        <textarea
          value={formData.prompt}
          onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
          placeholder="Instructions pour l'IA..."
          rows={4}
          className="ghost-input-line w-full resize-none min-h-(--height-textarea-sm)"
        />
      </div>

      <div>
        <label className="ghost-meta-label block mb-4">Fréquence</label>
        <div className="grid grid-cols-2 gap-px bg-[var(--line)]">
          {FREQUENCY_OPTIONS.map((option) => {
            const selected = formData.frequency === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setFormData({ ...formData, frequency: option.value })}
                className={`text-left p-4 transition-colors ${
                  selected
                    ? "bg-[var(--bg-soft)] text-(--accent-teal)"
                    : "bg-bg text-text-muted hover:bg-bg-elev"
                }`}
              >
                <p className={`t-13 font-medium ${selected ? "" : "text-text-soft"}`}>
                  {option.label}
                </p>
                <p className="t-11 font-light text-text-faint mt-1">{option.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {formData.frequency === "custom" && (
        <div>
          <label className="ghost-meta-label block mb-2">Expression cron</label>
          <input
            type="text"
            value={formData.customCron}
            onChange={(e) => setFormData({ ...formData, customCron: e.target.value })}
            placeholder="0 9 * * 1"
            className="ghost-input-line w-full font-mono t-9"
          />
          <p className="t-10 font-mono text-text-faint mt-2">min heure jour mois jour-semaine</p>
        </div>
      )}

      <div>
        <label className="ghost-meta-label block mb-2">Approbateurs (optionnel)</label>
        <input
          type="text"
          value={approversRaw}
          onChange={(e) => setApproversRaw(e.target.value)}
          placeholder="email1@exemple.com, email2@exemple.com"
          className="ghost-input-line w-full"
        />
        <p className="t-10 font-mono text-text-faint mt-2">
          Avant chaque exécution, un email d&apos;approbation est envoyé à chaque adresse. Séparées
          par virgule.
        </p>
      </div>

      {parseApproversInput(approversRaw).length > 0 && (
        <div>
          <label className="ghost-meta-label block mb-4">Mode d&apos;approbation</label>
          <div className="grid grid-cols-3 gap-px bg-[var(--line)]">
            {APPROVAL_MODE_OPTIONS.map((option) => {
              const selected = (formData.approvalMode ?? "all") === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, approvalMode: option.value })}
                  className={`text-left p-4 transition-colors ${
                    selected
                      ? "bg-[var(--bg-soft)] text-(--accent-teal)"
                      : "bg-bg text-text-muted hover:bg-bg-elev"
                  }`}
                >
                  <p className={`t-13 font-medium ${selected ? "" : "text-text-soft"}`}>
                    {option.label}
                  </p>
                  <p className="t-11 font-light text-text-faint mt-1">{option.description}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between py-4 border-y border-(--line)">
        <div>
          <p className="t-9 font-medium text-text-soft">Mission activée</p>
          <p className="t-10 font-mono text-text-faint mt-1">Exécution selon fréquence</p>
        </div>
        <button
          type="button"
          onClick={() => setFormData({ ...formData, enabled: !formData.enabled })}
          className={`w-12 h-6 rounded-sm transition-colors relative border ${
            formData.enabled
              ? "border-(--accent-teal) bg-[var(--bg-soft)]"
              : "border-(--line-strong) bg-bg"
          }`}
          aria-pressed={formData.enabled}
        >
          <span
            className={`absolute top-1 w-4 h-4 rounded-sm transition-[left,background-color] duration-(--duration-base) ${
              formData.enabled ? "left-6 bg-(--accent-teal)" : "left-1 bg-[var(--text-muted)]"
            }`}
          />
        </button>
      </div>

      <div className="flex gap-3 pt-2">
        <Action variant="secondary" tone="neutral" onClick={onCancel} className="flex-1">
          Annuler
        </Action>
        <Action
          type="submit"
          variant="primary"
          tone="brand"
          disabled={!isValid}
          loading={isLoading}
          className="flex-1"
        >
          Enregistrer
        </Action>
      </div>
    </form>
  );
}
