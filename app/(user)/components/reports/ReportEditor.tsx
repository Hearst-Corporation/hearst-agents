"use client";

/**
 * ReportEditor — éditeur visuel du ReportSpec actif (panneau latéral).
 *
 * Diffère de `ReportSpecEditor` (mode démo full-page, preview live + Apply
 * one-shot) : ici on opère sur le spec courant rendu par ReportLayout, on
 * émet `onChange` à chaque modif (toggle hidden, reorder, reset) pour que
 * le parent puisse mettre à jour son state et re-rendre les blocks.
 *
 * Features V1 :
 *   1. Toggle visibilité (`block.hidden`) par block — checkbox accent-teal
 *   2. Réordonner blocks via boutons ↑/↓ (premier ne monte pas, dernier
 *      ne descend pas — désactivés)
 *   3. Preview JSON readonly du spec courant (collapsible, mono pre)
 *   4. Reset → restaure la copie initiale mémorisée au mount
 *
 * UI : panneau scrollable (parent gère width / position). Pas de modal,
 * pas de drag-drop natif. Tokens uniquement, conforme CLAUDE.md.
 *
 * Test surface (data-testid) :
 *   - `report-editor`               (root)
 *   - `report-editor-reset`         (bouton Reset)
 *   - `report-editor-close`         (bouton fermeture, optionnel via onClose)
 *   - `report-editor-toggle-{id}`   (checkbox hidden)
 *   - `report-editor-up-{id}`       (bouton remonter)
 *   - `report-editor-down-{id}`     (bouton descendre)
 *   - `report-editor-json`          (pre readonly)
 *   - `report-editor-json-toggle`   (bouton expand/collapse JSON)
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReportSpec } from "@/lib/reports/spec/schema";
import type { TemplateSummary } from "@/lib/reports/templates/schema";
import { BlockEditorRow } from "./_parts/BlockEditorRow";
import { EditorHeader } from "./_parts/EditorHeader";
import { EditorToolbar } from "./_parts/EditorToolbar";
import { LoadTemplateList } from "./_parts/LoadTemplateList";
import { SaveTemplateForm } from "./_parts/SaveTemplateForm";

export interface ReportEditorProps {
  /** Spec courant édité — source de vérité, contrôlé par le parent. */
  spec: ReportSpec;
  /** Callback émis à chaque modification (toggle hidden, reorder, reset). */
  onChange: (spec: ReportSpec) => void;
  /** Callback optionnel pour fermer le panneau (bouton ✕ dans le header). */
  onClose?: () => void;
}

// ── Statuts de feedback pour save/load template ─────────────

type SaveStatus = "idle" | "form" | "saved" | "error";
type LoadStatus = "idle" | "loading_list" | "list" | "loading_spec" | "error";

export function ReportEditor({ spec, onChange, onClose }: ReportEditorProps) {
  // Mémorise une copie initiale du spec au mount pour permettre Reset.
  const [initialSpec] = useState<ReportSpec>(() => structuredClone(spec));
  const [jsonOpen, setJsonOpen] = useState(false);

  // ── Template save state ─────────────────────────────────────
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [isSaving, setIsSaving] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveDesc, setSaveDesc] = useState("");
  const saveNameRef = useRef<HTMLInputElement>(null);

  // ── Template load state ─────────────────────────────────────
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("idle");
  const [templateList, setTemplateList] = useState<TemplateSummary[]>([]);

  // ESC ferme le panneau si onClose fourni.
  useEffect(() => {
    if (!onClose) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const toggleHidden = useCallback(
    (blockId: string) => {
      const next = spec.blocks.map((b) => (b.id === blockId ? { ...b, hidden: !b.hidden } : b));
      onChange({ ...spec, blocks: next });
    },
    [spec, onChange],
  );

  const move = useCallback(
    (index: number, direction: -1 | 1) => {
      const target = index + direction;
      if (target < 0 || target >= spec.blocks.length) return;
      const next = [...spec.blocks];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      onChange({ ...spec, blocks: next });
    },
    [spec, onChange],
  );

  const reset = useCallback(() => {
    onChange(structuredClone(initialSpec));
  }, [initialSpec, onChange]);

  // ── Handlers save template ──────────────────────────────────

  const openSaveForm = useCallback(() => {
    setSaveName(spec.meta.title);
    setSaveDesc("");
    setSaveStatus("form");
    setTimeout(() => saveNameRef.current?.focus(), 50);
  }, [spec.meta.title]);

  const cancelSave = useCallback(() => {
    setSaveStatus("idle");
    setSaveName("");
    setSaveDesc("");
  }, []);

  const confirmSave = useCallback(async () => {
    if (!saveName.trim()) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/reports/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: saveName.trim(),
          description: saveDesc.trim() || undefined,
          spec,
          isPublic: false,
        }),
      });
      if (!res.ok) throw new Error("save_failed");
      setIsSaving(false);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2500);
      setSaveName("");
      setSaveDesc("");
    } catch {
      setIsSaving(false);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }, [saveName, saveDesc, spec]);

  // ── Handlers load template ──────────────────────────────────

  const openLoadList = useCallback(async () => {
    setLoadStatus("loading_list");
    try {
      const res = await fetch("/api/reports/templates");
      if (!res.ok) throw new Error("list_failed");
      const data = (await res.json()) as { templates: TemplateSummary[] };
      setTemplateList(data.templates ?? []);
      setLoadStatus("list");
    } catch {
      setLoadStatus("error");
      setTimeout(() => setLoadStatus("idle"), 3000);
    }
  }, []);

  const cancelLoad = useCallback(() => {
    setLoadStatus("idle");
    setTemplateList([]);
  }, []);

  const loadTemplateSpec = useCallback(
    async (templateId: string) => {
      setLoadStatus("loading_spec");
      try {
        const res = await fetch(`/api/reports/templates/${templateId}`);
        if (!res.ok) throw new Error("load_failed");
        const data = (await res.json()) as { spec: ReportSpec };
        onChange(data.spec);
        setLoadStatus("idle");
        setTemplateList([]);
      } catch {
        setLoadStatus("error");
        setTimeout(() => setLoadStatus("idle"), 3000);
      }
    },
    [onChange],
  );

  const visibleCount = spec.blocks.filter((b) => !b.hidden).length;
  const totalCount = spec.blocks.length;

  return (
    <aside
      aria-label="Éditeur de rapport"
      data-testid="report-editor"
      className="flex flex-col h-full w-full"
      style={{
        background: "var(--card-flat-bg)",
        borderLeft: "1px solid var(--card-flat-border)",
        gap: "var(--space-4)",
        padding: "var(--space-5)",
      }}
    >
      <EditorHeader visibleCount={visibleCount} totalCount={totalCount} onClose={onClose} />

      <EditorToolbar
        jsonOpen={jsonOpen}
        onToggleJson={() => setJsonOpen((v) => !v)}
        onReset={reset}
        saveStatus={saveStatus}
        loadStatus={loadStatus}
        onOpenSaveForm={openSaveForm}
        onOpenLoadList={openLoadList}
      />

      {saveStatus === "form" && (
        <SaveTemplateForm
          saveName={saveName}
          saveDesc={saveDesc}
          isSaving={isSaving}
          saveNameRef={saveNameRef}
          onChangeName={setSaveName}
          onChangeDesc={setSaveDesc}
          onConfirm={() => void confirmSave()}
          onCancel={cancelSave}
        />
      )}

      {loadStatus === "list" && (
        <LoadTemplateList
          templateList={templateList}
          onLoad={(id) => void loadTemplateSpec(id)}
          onCancel={cancelLoad}
        />
      )}

      {/* Liste des blocks — toggle + up/down */}
      <ul
        className="flex flex-col flex-1 overflow-y-auto"
        style={{ gap: "var(--space-2)" }}
        data-testid="report-editor-block-list"
      >
        {spec.blocks.map((block, index) => (
          <BlockEditorRow
            key={block.id}
            block={block}
            index={index}
            total={spec.blocks.length}
            onToggle={() => toggleHidden(block.id)}
            onMoveUp={() => move(index, -1)}
            onMoveDown={() => move(index, 1)}
          />
        ))}
      </ul>

      {/* Preview JSON */}
      {jsonOpen && (
        <pre
          data-testid="report-editor-json"
          className="t-9 font-mono text-text-soft overflow-auto"
          style={{
            padding: "var(--space-3)",
            background: "var(--surface-1)",
            border: "1px solid var(--surface-2)",
            borderRadius: "var(--radius-xs)",
            lineHeight: "var(--leading-base)",
            maxHeight: "var(--height-admin-prompt-max)",
            margin: 0,
          }}
        >
          {JSON.stringify(spec, null, 2)}
        </pre>
      )}
    </aside>
  );
}
