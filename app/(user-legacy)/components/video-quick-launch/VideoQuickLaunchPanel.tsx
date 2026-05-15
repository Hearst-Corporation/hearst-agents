"use client";

/**
 * VideoQuickLaunchPanel — Panel latéral ⌘G (S2-A + Q3-A batch mode).
 *
 * Composant racine : gère le shell (slide-in droite, ESC, focus trap),
 * le toggle simple/batch et l'orchestration submission + ouverture stage.
 *
 * Mode simple (S2-A) : génère 1 vidéo. Prompt + provider + Generate. Progression
 * du worker `video-gen` (BullMQ) streamée en SSE depuis
 * `/api/v2/jobs/[jobId]/progress`.
 *
 * Mode batch (Q3-A) : 2 à 4 variants en parallèle. Toggle "Mode batch" → form
 * affiche N sous-formulaires (chaque variant a son prompt + override provider/
 * durée/ratio). Bouton "Lancer le batch" POST `/api/v2/assets/batch`. Les N
 * jobIds reçus → N EventSource ouverts en parallèle, chaque card affiche sa
 * propre progress bar + label phase. Quand TOUS les jobs sont done|error,
 * bouton "Comparer les résultats" → AssetCompareStage(assetIds=[N variants]).
 *
 * Note : on transporte `assetId` (l'asset shell parent) dans le payload, mais
 * AssetCompareStage attend N assetIds DISTINCTS. Pour Q3-A simple, on passe
 * [assetId, assetId] (un seul asset shell, plusieurs variants accrochés). Si
 * l'utilisateur veut comparer, il verra le même asset N fois — limite connue.
 * Pour comparer vraiment, il faudra reswap par les variantIds (futur it).
 *
 * Pas de backdrop opaque (style "side panel"), juste un slide-in droite.
 * ESC ferme. ⌘G toggle (géré par useGlobalHotkeys).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useModalA11y } from "@/app/(user-legacy)/hooks/useModalA11y";
import { useStageStore } from "@/stores/stage";
import { useVideoQuickLaunchStore } from "@/stores/video-quick-launch";
import { FooterActions } from "./_parts/FooterActions";
import { ModeToggle } from "./_parts/ModeToggle";
import { PanelBody } from "./_parts/PanelBody";
import { PanelHeader } from "./_parts/PanelHeader";
import { useBatchSubmit } from "./hooks/useBatchSubmit";
import { useSingleSubmit } from "./hooks/useSingleSubmit";
import { useVideoBatchSSE } from "./hooks/useVideoBatchSSE";
import { useVideoSSE } from "./hooks/useVideoSSE";
import {
  type BatchVariantForm,
  type DurationOption,
  MAX_BATCH_VARIANTS,
  makeBatchForm,
  type Provider,
  progressLabel,
  type RatioOption,
} from "./types";

export function VideoQuickLaunchPanel() {
  const open = useVideoQuickLaunchStore((s) => s.open);
  const close = useVideoQuickLaunchStore((s) => s.close);
  const setStageMode = useStageStore((s) => s.setMode);

  // ── Mode batch toggle ──────────────────────────────────────────
  const [batchMode, setBatchMode] = useState(false);

  // ── Single mode form state ────────────────────────────────────
  const [prompt, setPrompt] = useState("");
  const [provider, setProvider] = useState<Provider>("runway");
  const [duration, setDuration] = useState<DurationOption>(5);
  const [ratio, setRatio] = useState<RatioOption>("1280:720");
  const [createdAssetId, setCreatedAssetId] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // SSE single (phase / progress / errorMsg + subscribe).
  const single = useVideoSSE();

  // ── Batch mode form state ─────────────────────────────────────
  const [batchForms, setBatchForms] = useState<BatchVariantForm[]>(() => [
    makeBatchForm(),
    makeBatchForm(),
  ]);

  // SSE batch (phase / runs / assetId / errorMsg + subscribe + initRuns).
  const batch = useVideoBatchSSE();

  // ── Reset complet ──────────────────────────────────────────────
  const resetAll = useCallback(() => {
    setPrompt("");
    setProvider("runway");
    setDuration(5);
    setRatio("1280:720");
    setCreatedAssetId(null);
    single.reset();
    setBatchMode(false);
    setBatchForms([makeBatchForm(), makeBatchForm()]);
    batch.reset();
  }, [single, batch]);

  // ── ESC handler + focus trap + restore focus (hook a11y) ───────
  const panelRef = useModalA11y<HTMLElement>(open, {
    onClose: close,
    autoFocus: false,
    lockBodyScroll: false,
  });

  // ── Reset au close + auto-focus textarea à l'open ─────────────
  useEffect(() => {
    if (!open) {
      const t = setTimeout(resetAll, 250);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      textareaRef.current?.focus();
    }, 150);
    return () => clearTimeout(t);
  }, [open, resetAll]);

  // ── SINGLE MODE : submit (logique extraite dans hook) ─────────
  const submit = useSingleSubmit({
    prompt,
    provider,
    duration,
    ratio,
    single,
    onAssetCreated: setCreatedAssetId,
  });

  const openAsset = useCallback(() => {
    if (!createdAssetId) return;
    setStageMode({
      mode: "asset",
      assetId: createdAssetId,
      variantKind: "video",
    });
    close();
  }, [createdAssetId, setStageMode, close]);

  // ── BATCH MODE : helpers form ──────────────────────────────────
  const updateBatchForm = useCallback((localId: string, patch: Partial<BatchVariantForm>) => {
    setBatchForms((prev) => prev.map((f) => (f.localId === localId ? { ...f, ...patch } : f)));
  }, []);

  const addBatchForm = useCallback(() => {
    setBatchForms((prev) => {
      if (prev.length >= MAX_BATCH_VARIANTS) return prev;
      const last = prev[prev.length - 1];
      return [
        ...prev,
        makeBatchForm({
          provider: last.provider,
          duration: last.duration,
          ratio: last.ratio,
        }),
      ];
    });
  }, []);

  const removeBatchForm = useCallback((localId: string) => {
    setBatchForms((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((f) => f.localId !== localId);
    });
  }, []);

  // ── BATCH MODE : submit (logique extraite dans hook) ──────────
  const submitBatch = useBatchSubmit({ batchForms, batch });

  // ── BATCH MODE : ouvrir AssetCompareStage ──────────────────────
  const openCompare = useCallback(() => {
    if (!batch.assetId) return;
    const ids = batch.runs.filter((r) => r.phase === "done").map(() => batch.assetId as string);
    if (ids.length < 2) {
      setStageMode({
        mode: "asset",
        assetId: batch.assetId,
        variantKind: "video",
      });
    } else {
      setStageMode({ mode: "asset_compare", assetIds: ids });
    }
    close();
  }, [batch.assetId, batch.runs, setStageMode, close]);

  const isSingleBusy =
    single.phase === "creating" || single.phase === "queued" || single.phase === "running";
  const isBatchBusy = batch.phase === "creating" || batch.phase === "running";

  const phaseLabel = useMemo(() => {
    if (single.phase === "creating") return "Création de l'asset…";
    if (single.phase === "queued") return "Mise en file…";
    if (single.phase === "running") return progressLabel(single.progress, provider);
    if (single.phase === "done") return "Vidéo prête";
    if (single.phase === "error") return "Échec";
    return "";
  }, [single.phase, single.progress, provider]);

  const validBatchCount = batchForms.filter((f) => f.prompt.trim().length > 0).length;

  const resetSingle = useCallback(() => {
    single.setPhase("idle");
    single.setProgress(0);
    single.setErrorMsg(null);
  }, [single]);

  const resetBatch = useCallback(() => {
    batch.setPhase("idle");
    batch.setRuns([]);
    batch.setErrorMsg(null);
  }, [batch]);

  return (
    <aside
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="Lancement rapide vidéo"
      aria-hidden={!open}
      className="fixed top-0 right-0 h-screen flex flex-col"
      style={{
        zIndex: "var(--z-modal)" as unknown as number,
        width: "var(--width-quick-launch)",
        maxWidth: "100vw",
        background: "var(--bg-elev)",
        borderLeft: "1px solid var(--border-shell)",
        boxShadow: "var(--shadow-card)",
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition: "transform var(--duration-slow) var(--ease-standard)",
        pointerEvents: open ? "auto" : "none",
        visibility: open ? "visible" : "hidden",
      }}
    >
      <PanelHeader batchMode={batchMode} onClose={close} />

      <ModeToggle
        batchMode={batchMode}
        isBatchBusy={isBatchBusy}
        batchDone={batch.phase === "done"}
        isSingleBusy={isSingleBusy}
        singleDone={single.phase === "done"}
        onSetSingle={() => setBatchMode(false)}
        onSetBatch={() => setBatchMode(true)}
      />

      <PanelBody
        batchMode={batchMode}
        prompt={prompt}
        setPrompt={setPrompt}
        provider={provider}
        setProvider={setProvider}
        duration={duration}
        setDuration={setDuration}
        ratio={ratio}
        setRatio={setRatio}
        singlePhase={single.phase}
        singleProgress={single.progress}
        phaseLabel={phaseLabel}
        singleErrorMsg={single.errorMsg}
        isSingleBusy={isSingleBusy}
        textareaRef={textareaRef}
        batchForms={batchForms}
        updateBatchForm={updateBatchForm}
        addBatchForm={addBatchForm}
        removeBatchForm={removeBatchForm}
        isBatchBusy={isBatchBusy}
        batchDone={batch.phase === "done"}
        batchRuns={batch.runs}
        batchPhase={batch.phase}
        batchError={batch.errorMsg}
      />

      {/* Footer actions */}
      <footer
        className="flex items-center justify-end"
        style={{
          padding: "var(--space-4) var(--space-6)",
          borderTop: "1px solid var(--border-shell)",
          gap: "var(--space-3)",
        }}
      >
        <FooterActions
          batchMode={batchMode}
          singlePhase={single.phase}
          createdAssetId={createdAssetId}
          isSingleBusy={isSingleBusy}
          promptEmpty={!prompt.trim()}
          onSubmitSingle={() => void submit()}
          onOpenAsset={openAsset}
          onResetSingle={resetSingle}
          batchPhase={batch.phase}
          validBatchCount={validBatchCount}
          isBatchBusy={isBatchBusy}
          onSubmitBatch={() => void submitBatch()}
          onOpenCompare={openCompare}
          onResetBatch={resetBatch}
          onClose={close}
        />
      </footer>
    </aside>
  );
}
