"use client";

/**
 * Commandeur — Command palette globale (Cmd+K) sémantique.
 *
 * Sections (collapse-friendly visuellement, rendues si non-vide) :
 *   - Actions    → hardcoded (navigate, stages, quick actions)
 *   - Recent     → threads récents (max 5)
 *   - Assets     → résultats search /api/v2/search?q=
 *   - Missions   → idem
 *   - Threads    → idem (chat_messages content)
 *   - Tools      → placeholder Phase B suivante (apps connectées)
 *   - KG         → kg_nodes
 *
 * Comportement :
 *   - Query vide → Actions + Recent uniquement (pas de fetch)
 *   - Query non-vide → debounced fetch (200ms) + filtre local sur Actions
 *   - Hotkeys ⌘1-9 / ⌘K / ⌘B / ⌘⇧V intacts (gérés par useGlobalHotkeys)
 *   - Keyboard nav ↑↓ entre toutes les sections, Enter, Esc
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useStageStore, type StagePayload } from "@/stores/stage";
import { useFocalStore } from "@/stores/focal";
import { useNavigationStore } from "@/stores/navigation";
import { CommandeurResultRow } from "./CommandeurResultRow";
import { useCommandeurData } from "./use-commandeur-data";
import { useModalA11y } from "@/app/(user)/hooks/useModalA11y";
import { AssetCompareModal } from "./AssetCompareModal";
import { useCommandeurActions, type CommandRow } from "./use-commandeur-actions";
import { useCommandeurSections } from "./use-commandeur-sections";

export function Commandeur() {
  const router = useRouter();
  const isOpen = useStageStore((s) => s.commandeurOpen);
  const setOpen = useStageStore((s) => s.setCommandeurOpen);
  const consumePrefill = useStageStore((s) => s.consumeCommandeurPrefilledQuery);
  const setStageMode = useStageStore((s) => s.setMode);
  const lastAssetId = useStageStore((s) => s.lastAssetId);
  const threads = useNavigationStore((s) => s.threads);
  const setActiveThread = useNavigationStore((s) => s.setActiveThread);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [compareOpen, setCompareOpen] = useState(false);

  const { results, loading } = useCommandeurData(query, isOpen);

  // ── Actions hardcoded ──────────────────────────────────────────
  const allActions = useCommandeurActions({
    router,
    setOpen,
    setStageMode,
    lastAssetId,
    onCompareOpen: () => setCompareOpen(true),
  });

  // ── Recent threads (depuis store nav, max 5) ───────────────────
  const recentRows = useMemo<CommandRow[]>(() => {
    return [...threads]
      .filter((t) => !t.archived)
      .sort((a, b) => b.lastActivity - a.lastActivity)
      .slice(0, 5)
      .map((thread) => ({
        id: `recent-${thread.id}`,
        kind: "thread" as const,
        label: thread.name || "Conversation",
        hint: new Date(thread.lastActivity).toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "short",
        }),
        perform: () => {
          setActiveThread(thread.id);
          setStageMode({ mode: "chat", threadId: thread.id } as StagePayload);
          setOpen(false);
        },
      }));
  }, [threads, setActiveThread, setStageMode, setOpen]);

  // ── Sections rendues (logique extraite dans hook) ──────────────
  const sections = useCommandeurSections({
    query,
    allActions,
    recentRows,
    results,
    setStageMode,
    setActiveThread,
    setOpen,
    router,
  });

  // Flatten pour la nav clavier.
  const flatRows = useMemo<CommandRow[]>(
    () => sections.flatMap((s) => s.rows),
    [sections],
  );

  useEffect(() => {
    if (!isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset à la fermeture
      setQuery("");
      setActiveIndex(0);
      return;
    }
    const prefill = consumePrefill();
    if (prefill) {
      setQuery(prefill);
      return;
    }
    const stageMode = useStageStore.getState().current.mode;
    const focal = useFocalStore.getState().focal;
    if (focal?.title) {
      if (stageMode === "asset") {
        setQuery(`Améliorer "${focal.title}"`);
      } else if (stageMode === "mission") {
        setQuery(`Résumé de la mission "${focal.title}"`);
      }
    }
  }, [isOpen, consumePrefill]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset index quand query change
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); setOpen(false); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, flatRows.length - 1)); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); return; }
      if (e.key === "Enter") {
        e.preventDefault();
        const row = flatRows[activeIndex];
        if (row && !row.disabled) row.perform();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, flatRows, activeIndex, setOpen]);

  // Hook a11y : focus trap + scroll lock body + restore focus.
  const dialogRef = useModalA11y<HTMLDivElement>(isOpen, {
    onClose: () => setOpen(false),
    closeOnEscape: false,
    autoFocus: false,
  });

  const compareModal = (
    <AssetCompareModal
      open={compareOpen}
      onCancel={() => setCompareOpen(false)}
      onCompare={(idA, idB) => {
        setCompareOpen(false);
        setStageMode({ mode: "asset_compare", assetIds: [idA, idB] } as StagePayload);
      }}
    />
  );

  if (!isOpen) return compareModal;

  let runningIndex = 0;

  return (
    <>
    <div
      className="fixed inset-0 flex items-start justify-center transition-opacity duration-(--duration-slow)"
      style={{
        zIndex: "var(--z-modal)" as unknown as number,
        background: "var(--overlay-scrim)",
        backdropFilter: "var(--blur-lg)",
        WebkitBackdropFilter: "var(--blur-lg)",
        paddingTop: "15vh",
      }}
      onClick={() => setOpen(false)}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Palette de commandes"
        className="w-full max-w-3xl overflow-hidden transition-[opacity,transform] duration-(--duration-slow) border-l border-(--border-shell)"
        style={{ background: "transparent" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-8 px-12 py-8">
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher..."
            className="flex-1 bg-transparent t-48 leading-none font-bold tracking-tight text-text placeholder-[var(--text-ghost)] outline-none"
          />
          {loading && (
            <span className="t-11 font-light text-text-faint">
              Recherche…
            </span>
          )}
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-12 pb-16 scrollbar-hide">
          {sections.length === 0 ? (
            <p className="t-13 text-text-ghost font-light">Aucun résultat.</p>
          ) : (
            <div className="flex flex-col" style={{ gap: "var(--space-6)" }}>
              {sections.map((section) => (
                <section key={section.key} className="flex flex-col gap-1">
                  <h2
                    className="t-11 font-light"
                    style={{ color: "var(--text-ghost)", marginBottom: "var(--space-2)" }}
                  >
                    {section.title}
                  </h2>
                  {section.rows.map((row) => {
                    const myIndex = runningIndex++;
                    return (
                      <CommandeurResultRow
                        key={row.id}
                        kind={row.kind}
                        label={row.label}
                        hint={row.hint}
                        hotkey={row.hotkey}
                        active={myIndex === activeIndex}
                        disabled={row.disabled}
                        onSelect={() => { if (!row.disabled) row.perform(); }}
                        onHover={() => { if (!row.disabled) setActiveIndex(myIndex); }}
                      />
                    );
                  })}
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
    {compareModal}
    </>
  );
}
