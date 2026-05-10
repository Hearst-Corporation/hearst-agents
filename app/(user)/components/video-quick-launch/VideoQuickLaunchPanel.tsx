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
import { useVideoQuickLaunchStore } from "@/stores/video-quick-launch";
import { useStageStore } from "@/stores/stage";
import { Action } from "../ui";
import { useModalA11y } from "@/app/(user)/hooks/useModalA11y";
import { VideoSimpleForm } from "./VideoSimpleForm";
import { VideoBatchForm } from "./VideoBatchForm";
import { useVideoSSE } from "./hooks/useVideoSSE";
import { useVideoBatchSSE } from "./hooks/useVideoBatchSSE";
import {
  MAX_BATCH_VARIANTS,
  makeBatchForm,
  progressLabel,
  type BatchVariantForm,
  type DurationOption,
  type Provider,
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

    // Reset batch.
    setBatchMode(false);
    setBatchForms([makeBatchForm(), makeBatchForm()]);
    batch.reset();
  }, [single, batch]);

  // ── ESC handler + focus trap + restore focus (hook a11y) ───────
  // Side panel : pas de scroll lock body (panel non-bloquant côté UX —
  // l'utilisateur peut toujours scroller le shell derrière). autoFocus
  // désactivé : on focalise manuellement le textarea (premier champ
  // d'intérêt) avec un léger délai (animation slide-in).
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

  // ── SINGLE MODE : submit ───────────────────────────────────────
  const submit = useCallback(async () => {
    if (
      !prompt.trim() ||
      single.phase === "creating" ||
      single.phase === "queued" ||
      single.phase === "running"
    )
      return;
    single.setErrorMsg(null);
    single.setProgress(0);
    single.setPhase("creating");

    try {
      const shellName = prompt.trim().slice(0, 80) || "Vidéo générée";
      const assetRes = await fetch("/api/v2/assets", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "text",
          name: shellName,
          metadata: {
            origin: "video-quick-launch",
            content: prompt.trim(),
          },
        }),
      });
      const assetBody = await assetRes.json();
      if (!assetRes.ok || !assetBody?.asset?.id) {
        throw new Error(assetBody?.error ?? "Création de l'asset échouée");
      }
      const assetId: string = assetBody.asset.id;
      setCreatedAssetId(assetId);

      single.setPhase("queued");
      const variantRes = await fetch(
        `/api/v2/assets/${encodeURIComponent(assetId)}/variants`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "video",
            provider,
            prompt: prompt.trim(),
            scriptText: prompt.trim(),
            durationSeconds: duration,
            ratio: provider === "runway" ? ratio : undefined,
          }),
        },
      );
      const variantBody = await variantRes.json();
      if (!variantRes.ok) {
        throw new Error(
          variantBody?.message ??
            variantBody?.error ??
            "Enqueue du job échoué",
        );
      }
      const jobId: string | undefined = variantBody.jobId;
      if (!jobId) {
        throw new Error("Job ID manquant dans la réponse variants.");
      }

      single.subscribe(jobId, provider);
    } catch (err) {
      single.setErrorMsg(
        err instanceof Error ? err.message : "Erreur inattendue",
      );
      single.setPhase("error");
    }
  }, [prompt, provider, duration, ratio, single]);

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
  const updateBatchForm = useCallback(
    (localId: string, patch: Partial<BatchVariantForm>) => {
      setBatchForms((prev) =>
        prev.map((f) => (f.localId === localId ? { ...f, ...patch } : f)),
      );
    },
    [],
  );

  const addBatchForm = useCallback(() => {
    setBatchForms((prev) => {
      if (prev.length >= MAX_BATCH_VARIANTS) return prev;
      // Seed le nouveau form depuis le précédent (provider/duration/ratio communs)
      // — l'user veut souvent tester le même prompt avec une variation mineure.
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

  // ── BATCH MODE : submit ────────────────────────────────────────
  const submitBatch = useCallback(async () => {
    const validForms = batchForms.filter((f) => f.prompt.trim().length > 0);
    if (
      validForms.length === 0 ||
      batch.phase === "creating" ||
      batch.phase === "running"
    )
      return;

    batch.setErrorMsg(null);
    batch.setPhase("creating");
    batch.setRuns([]);
    batch.setAssetId(null);

    try {
      const res = await fetch("/api/v2/assets/batch", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variants: validForms.map((f) => ({
            prompt: f.prompt.trim(),
            provider: f.provider,
            durationSeconds: f.duration,
            ratio: f.provider === "runway" ? f.ratio : undefined,
          })),
        }),
      });

      const body = await res.json();
      if (!res.ok || !body?.assetId) {
        throw new Error(
          body?.message ?? body?.error ?? "Échec de la création du batch",
        );
      }

      const assetId: string = body.assetId;
      const jobs: Array<{
        kind: string;
        jobId: string;
        variantId: string;
        index: number;
      }> = body.jobs ?? [];

      batch.setAssetId(assetId);
      batch.initRuns(validForms, jobs);
      batch.setPhase("running");

      // Open EventSource en parallèle pour chaque job qui a bien été enqueué.
      jobs.forEach((job) => {
        batch.subscribe(job.jobId, job.index);
      });

      // Si TOUS les jobs ont échoué dès l'enqueue, on bascule en error.
      if (jobs.length === 0) {
        batch.setPhase("error");
        batch.setErrorMsg("Aucun variant n'a pu être enqueué");
      }
    } catch (err) {
      batch.setErrorMsg(
        err instanceof Error ? err.message : "Erreur inattendue",
      );
      batch.setPhase("error");
    }
  }, [batchForms, batch]);

  // ── BATCH MODE : ouvrir AssetCompareStage ──────────────────────
  const openCompare = useCallback(() => {
    if (!batch.assetId) return;
    // Pour Q3-A on a un seul asset shell parent + N variants. Le compare
    // attend N assetIds distincts ; en attendant la version variants-aware
    // d'AssetCompareStage, on duplique l'assetId N fois pour montrer N panes
    // qui pointent vers le même asset (workaround). Une variante future :
    // étendre AssetCompareStage pour accepter `variantIds[]`.
    const ids = batch.runs
      .filter((r) => r.phase === "done")
      .map(() => batch.assetId as string);
    if (ids.length < 2) {
      // Pas assez de variants ready — fallback : ouvrir l'asset shell.
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
    single.phase === "creating" ||
    single.phase === "queued" ||
    single.phase === "running";
  const isBatchBusy =
    batch.phase === "creating" || batch.phase === "running";

  const phaseLabel = useMemo(() => {
    if (single.phase === "creating") return "Création de l'asset…";
    if (single.phase === "queued") return "Mise en file…";
    if (single.phase === "running")
      return progressLabel(single.progress, provider);
    if (single.phase === "done") return "Vidéo prête";
    if (single.phase === "error") return "Échec";
    return "";
  }, [single.phase, single.progress, provider]);

  const validBatchCount = batchForms.filter(
    (f) => f.prompt.trim().length > 0,
  ).length;

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
      {/* Header */}
      <header
        className="flex items-center justify-between"
        style={{
          padding: "var(--space-6)",
          borderBottom: "1px solid var(--border-shell)",
        }}
      >
        <div className="flex flex-col gap-1">
          <span className="t-15 font-medium text-text">
            {batchMode ? "Vidéo · batch" : "Vidéo rapide"}
          </span>
          <span className="t-11 font-light text-text-muted">
            {batchMode
              ? `Jusqu'à ${MAX_BATCH_VARIANTS} variants en parallèle`
              : "⌘G — prompt + provider + go"}
          </span>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Fermer"
          className="t-13 font-light text-text-muted hover:text-text transition-colors duration-base"
          style={{ padding: "var(--space-1) var(--space-2)" }}
        >
          ESC
        </button>
      </header>

      {/* Mode toggle */}
      <div
        className="flex"
        style={{
          padding: "var(--space-3) var(--space-6)",
          borderBottom: "1px solid var(--border-shell)",
          gap: "var(--space-2)",
        }}
      >
        <button
          type="button"
          onClick={() => setBatchMode(false)}
          disabled={isBatchBusy || batch.phase === "done"}
          className={`t-11 font-light transition-colors duration-base disabled:opacity-50 ${
            !batchMode
              ? "border border-(--accent-teal) text-(--accent-teal) bg-[var(--accent-teal-surface)]"
              : "border border-(--border-shell) text-text-muted hover:text-text"
          }`}
          style={{
            flex: 1,
            padding: "var(--space-2) var(--space-3)",
            borderRadius: "var(--radius-sm)",
          }}
        >
          1 variant
        </button>
        <button
          type="button"
          onClick={() => setBatchMode(true)}
          disabled={isSingleBusy || single.phase === "done"}
          className={`t-11 font-light transition-colors duration-base disabled:opacity-50 ${
            batchMode
              ? "border border-(--accent-teal) text-(--accent-teal) bg-[var(--accent-teal-surface)]"
              : "border border-(--border-shell) text-text-muted hover:text-text"
          }`}
          style={{
            flex: 1,
            padding: "var(--space-2) var(--space-3)",
            borderRadius: "var(--radius-sm)",
          }}
        >
          Mode batch
        </button>
      </div>

      {/* Body */}
      <div
        className="flex-1 flex flex-col overflow-y-auto"
        style={{ padding: "var(--space-6)", gap: "var(--space-5)" }}
      >
        {!batchMode ? (
          <VideoSimpleForm
            prompt={prompt}
            setPrompt={setPrompt}
            provider={provider}
            setProvider={setProvider}
            duration={duration}
            setDuration={setDuration}
            ratio={ratio}
            setRatio={setRatio}
            phase={single.phase}
            progress={single.progress}
            phaseLabel={phaseLabel}
            errorMsg={single.errorMsg}
            isBusy={isSingleBusy}
            textareaRef={textareaRef}
          />
        ) : (
          <VideoBatchForm
            forms={batchForms}
            updateForm={updateBatchForm}
            addForm={addBatchForm}
            removeForm={removeBatchForm}
            isBusy={isBatchBusy || batch.phase === "done"}
            runs={batch.runs}
            batchPhase={batch.phase}
            batchError={batch.errorMsg}
          />
        )}
      </div>

      {/* Footer actions */}
      <footer
        className="flex items-center justify-end"
        style={{
          padding: "var(--space-4) var(--space-6)",
          borderTop: "1px solid var(--border-shell)",
          gap: "var(--space-3)",
        }}
      >
        {!batchMode ? (
          single.phase === "done" && createdAssetId ? (
            <>
              <Action variant="ghost" tone="neutral" onClick={close}>
                Fermer
              </Action>
              <Action variant="primary" tone="brand" onClick={openAsset}>
                Ouvrir
              </Action>
            </>
          ) : single.phase === "error" ? (
            <>
              <Action variant="ghost" tone="neutral" onClick={close}>
                Fermer
              </Action>
              <Action
                variant="primary"
                tone="brand"
                onClick={() => {
                  single.setPhase("idle");
                  single.setProgress(0);
                  single.setErrorMsg(null);
                }}
              >
                Réessayer
              </Action>
            </>
          ) : (
            <Action
              variant="primary"
              tone="brand"
              onClick={() => void submit()}
              loading={isSingleBusy}
              disabled={!prompt.trim()}
            >
              Générer la vidéo
            </Action>
          )
        ) : batch.phase === "done" ? (
          <>
            <Action variant="ghost" tone="neutral" onClick={close}>
              Fermer
            </Action>
            <Action variant="primary" tone="brand" onClick={openCompare}>
              Comparer les résultats
            </Action>
          </>
        ) : batch.phase === "error" ? (
          <>
            <Action variant="ghost" tone="neutral" onClick={close}>
              Fermer
            </Action>
            <Action
              variant="primary"
              tone="brand"
              onClick={() => {
                batch.setPhase("idle");
                batch.setRuns([]);
                batch.setErrorMsg(null);
              }}
            >
              Réessayer
            </Action>
          </>
        ) : (
          <Action
            variant="primary"
            tone="brand"
            onClick={() => void submitBatch()}
            loading={isBatchBusy}
            disabled={validBatchCount === 0}
          >
            {`Lancer le batch (${validBatchCount})`}
          </Action>
        )}
      </footer>
    </aside>
  );
}
