"use client";

/**
 * VideoQuickLaunch — Panel latéral ⌘G (S2-A + Q3-A batch mode).
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
import { Action } from "./ui";

type Provider = "runway" | "heygen";
type DurationOption = 5 | 10;
type RatioOption = "1280:720" | "720:1280";

type SinglePhase = "idle" | "creating" | "queued" | "running" | "done" | "error";
type BatchVariantPhase = "queued" | "running" | "done" | "error";

const DURATION_LABELS: Record<DurationOption, string> = {
  5: "5 sec",
  10: "10 sec",
};

const RATIO_LABELS: Record<RatioOption, string> = {
  "1280:720": "Paysage",
  "720:1280": "Portrait",
};

const MAX_BATCH_VARIANTS = 4;

interface BatchVariantForm {
  /** ID local pour la stable React key. */
  localId: string;
  prompt: string;
  provider: Provider;
  duration: DurationOption;
  ratio: RatioOption;
}

interface BatchVariantRun {
  localId: string;
  /** Index dans le tableau de soumission — utilisé pour relier card ↔ form. */
  index: number;
  /** Form snapshot (provider/duration/ratio/prompt) pour affichage. */
  form: BatchVariantForm;
  /** jobId BullMQ retourné par /assets/batch. */
  jobId: string | null;
  /** variantId asset_variants. */
  variantId: string | null;
  phase: BatchVariantPhase;
  progress: number;
  errorMsg: string | null;
}

/**
 * Labels canoniques côté client : le worker n'expose pas le `message` de
 * `reportProgress` via QueueEvents (BullMQ ne stream que la valeur). On
 * reconstruit donc le label en fonction du % connu.
 */
function progressLabel(progress: number, provider: Provider): string {
  if (progress < 5) return "Initialisation…";
  if (progress < 20) return "Soumission au provider";
  if (progress < 80) return provider === "runway" ? "Runway génère la vidéo…" : "HeyGen prépare l'avatar…";
  if (progress < 90) return "Téléchargement de la vidéo";
  if (progress < 100) return "Upload sur le storage";
  return "Vidéo prête";
}

function makeBatchForm(seed?: Partial<BatchVariantForm>): BatchVariantForm {
  return {
    localId: typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    prompt: seed?.prompt ?? "",
    provider: seed?.provider ?? "runway",
    duration: seed?.duration ?? 5,
    ratio: seed?.ratio ?? "1280:720",
  };
}

export function VideoQuickLaunch() {
  const open = useVideoQuickLaunchStore((s) => s.open);
  const close = useVideoQuickLaunchStore((s) => s.close);
  const setStageMode = useStageStore((s) => s.setMode);

  // ── Mode batch toggle ──────────────────────────────────────────
  const [batchMode, setBatchMode] = useState(false);

  // ── Single mode state (S2-A) ───────────────────────────────────
  const [prompt, setPrompt] = useState("");
  const [provider, setProvider] = useState<Provider>("runway");
  const [duration, setDuration] = useState<DurationOption>(5);
  const [ratio, setRatio] = useState<RatioOption>("1280:720");

  const [phase, setPhase] = useState<SinglePhase>("idle");
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createdAssetId, setCreatedAssetId] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // ── Batch mode state (Q3-A) ────────────────────────────────────
  const [batchForms, setBatchForms] = useState<BatchVariantForm[]>(() => [
    makeBatchForm(),
    makeBatchForm(),
  ]);
  const [batchPhase, setBatchPhase] = useState<"idle" | "creating" | "running" | "done" | "error">(
    "idle",
  );
  const [batchRuns, setBatchRuns] = useState<BatchVariantRun[]>([]);
  const [batchAssetId, setBatchAssetId] = useState<string | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);
  const batchEventSourcesRef = useRef<EventSource[]>([]);

  // ── Reset complet ──────────────────────────────────────────────
  const resetAll = useCallback(() => {
    setPrompt("");
    setProvider("runway");
    setDuration(5);
    setRatio("1280:720");
    setPhase("idle");
    setProgress(0);
    setErrorMsg(null);
    setCreatedAssetId(null);
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // Reset batch.
    setBatchMode(false);
    setBatchForms([makeBatchForm(), makeBatchForm()]);
    setBatchPhase("idle");
    setBatchRuns([]);
    setBatchAssetId(null);
    setBatchError(null);
    batchEventSourcesRef.current.forEach((es) => es.close());
    batchEventSourcesRef.current = [];
  }, []);

  // ── ESC + auto-focus ───────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      const t = setTimeout(resetAll, 250);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      textareaRef.current?.focus();
    }, 150);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close, resetAll]);

  // ── Cleanup au unmount ─────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      batchEventSourcesRef.current.forEach((es) => es.close());
      batchEventSourcesRef.current = [];
    };
  }, []);

  // ── SINGLE MODE : SSE subscribe ────────────────────────────────
  const subscribeToProgress = useCallback(
    (jobId: string, providerUsed: Provider) => {
      const url = `/api/v2/jobs/${encodeURIComponent(jobId)}/progress?kind=video-gen`;
      const es = new EventSource(url, { withCredentials: true });
      eventSourceRef.current = es;
      setPhase("running");

      es.addEventListener("progress", (ev) => {
        try {
          const data = JSON.parse((ev as MessageEvent<string>).data) as {
            progress: number;
            label?: string | null;
          };
          if (typeof data.progress === "number") {
            setProgress(data.progress);
          }
          void providerUsed;
        } catch {
          /* payload malformé — ignore */
        }
      });

      es.addEventListener("completed", () => {
        setProgress(100);
        setPhase("done");
        es.close();
        eventSourceRef.current = null;
      });

      es.addEventListener("failed", (ev) => {
        try {
          const data = JSON.parse((ev as MessageEvent<string>).data) as { reason?: string };
          setErrorMsg(data.reason ?? "Échec de la génération vidéo");
        } catch {
          setErrorMsg("Échec de la génération vidéo");
        }
        setPhase("error");
        es.close();
        eventSourceRef.current = null;
      });

      es.addEventListener("not_found", () => {
        setErrorMsg("Job introuvable côté queue.");
        setPhase("error");
        es.close();
        eventSourceRef.current = null;
      });

      es.onerror = () => {
        // EventSource retry automatiquement.
      };
    },
    [],
  );

  const submit = useCallback(async () => {
    if (!prompt.trim() || phase === "creating" || phase === "queued" || phase === "running") return;
    setErrorMsg(null);
    setProgress(0);
    setPhase("creating");

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

      setPhase("queued");
      const variantRes = await fetch(`/api/v2/assets/${encodeURIComponent(assetId)}/variants`, {
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
      });
      const variantBody = await variantRes.json();
      if (!variantRes.ok) {
        throw new Error(variantBody?.message ?? variantBody?.error ?? "Enqueue du job échoué");
      }
      const jobId: string | undefined = variantBody.jobId;
      if (!jobId) {
        throw new Error("Job ID manquant dans la réponse variants.");
      }

      subscribeToProgress(jobId, provider);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Erreur inattendue");
      setPhase("error");
    }
  }, [prompt, provider, duration, ratio, phase, subscribeToProgress]);

  const openAsset = useCallback(() => {
    if (!createdAssetId) return;
    setStageMode({ mode: "asset", assetId: createdAssetId, variantKind: "video" });
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
      return [...prev, makeBatchForm({ provider: last.provider, duration: last.duration, ratio: last.ratio })];
    });
  }, []);

  const removeBatchForm = useCallback((localId: string) => {
    setBatchForms((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((f) => f.localId !== localId);
    });
  }, []);

  // ── BATCH MODE : SSE subscribe par variant ─────────────────────
  const subscribeBatchVariant = useCallback((jobId: string, runIndex: number) => {
    const url = `/api/v2/jobs/${encodeURIComponent(jobId)}/progress?kind=video-gen`;
    const es = new EventSource(url, { withCredentials: true });
    batchEventSourcesRef.current.push(es);

    const updateRun = (patch: Partial<BatchVariantRun>) => {
      setBatchRuns((prev) =>
        prev.map((r) => (r.index === runIndex ? { ...r, ...patch } : r)),
      );
    };

    updateRun({ phase: "running" });

    es.addEventListener("progress", (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent<string>).data) as { progress: number };
        if (typeof data.progress === "number") {
          updateRun({ progress: data.progress, phase: "running" });
        }
      } catch {
        /* ignore */
      }
    });

    es.addEventListener("completed", () => {
      updateRun({ progress: 100, phase: "done" });
      es.close();
    });

    es.addEventListener("failed", (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent<string>).data) as { reason?: string };
        updateRun({ phase: "error", errorMsg: data.reason ?? "Échec" });
      } catch {
        updateRun({ phase: "error", errorMsg: "Échec" });
      }
      es.close();
    });

    es.addEventListener("not_found", () => {
      updateRun({ phase: "error", errorMsg: "Job introuvable" });
      es.close();
    });

    es.onerror = () => {
      // EventSource retry — laisse passer.
    };
  }, []);

  // ── BATCH MODE : submit ────────────────────────────────────────
  const submitBatch = useCallback(async () => {
    const validForms = batchForms.filter((f) => f.prompt.trim().length > 0);
    if (validForms.length === 0 || batchPhase === "creating" || batchPhase === "running") return;

    setBatchError(null);
    setBatchPhase("creating");
    setBatchRuns([]);
    setBatchAssetId(null);

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
        throw new Error(body?.message ?? body?.error ?? "Échec de la création du batch");
      }

      const assetId: string = body.assetId;
      const jobs: Array<{ kind: string; jobId: string; variantId: string; index: number }> =
        body.jobs ?? [];

      setBatchAssetId(assetId);

      // Initialise les runs (1 par form valide). Les jobs renvoyés sont
      // indexés par leur position dans la submission ; on map index → form.
      const runs: BatchVariantRun[] = validForms.map((form, i) => {
        const job = jobs.find((j) => j.index === i);
        return {
          localId: form.localId,
          index: i,
          form,
          jobId: job?.jobId ?? null,
          variantId: job?.variantId ?? null,
          phase: job ? "queued" : "error",
          progress: 0,
          errorMsg: job ? null : "Enqueue échoué",
        };
      });
      setBatchRuns(runs);
      setBatchPhase("running");

      // Open EventSource en parallèle pour chaque job qui a bien été enqueué.
      jobs.forEach((job) => {
        subscribeBatchVariant(job.jobId, job.index);
      });

      // Si TOUS les jobs ont échoué dès l'enqueue, on bascule en error.
      if (jobs.length === 0) {
        setBatchPhase("error");
        setBatchError("Aucun variant n'a pu être enqueué");
      }
    } catch (err) {
      setBatchError(err instanceof Error ? err.message : "Erreur inattendue");
      setBatchPhase("error");
    }
  }, [batchForms, batchPhase, subscribeBatchVariant]);

  // ── BATCH MODE : détection de la fin globale ───────────────────
  // Bascule batchPhase running → done quand tous les runs sont terminés.
  // L'update est dérivé du state runs (signal externe SSE) — la transition
  // d'état est intentionnelle ici, pas un cascade render à éviter.
  useEffect(() => {
    if (batchPhase !== "running" || batchRuns.length === 0) return;
    const allFinished = batchRuns.every((r) => r.phase === "done" || r.phase === "error");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- transition d'état dérivée d'un signal externe (SSE batch completion)
    if (allFinished) setBatchPhase("done");
  }, [batchRuns, batchPhase]);

  // ── BATCH MODE : ouvrir AssetCompareStage ──────────────────────
  const openCompare = useCallback(() => {
    if (!batchAssetId) return;
    // Pour Q3-A on a un seul asset shell parent + N variants. Le compare
    // attend N assetIds distincts ; en attendant la version variants-aware
    // d'AssetCompareStage, on duplique l'assetId N fois pour montrer N panes
    // qui pointent vers le même asset (workaround). Une variante future :
    // étendre AssetCompareStage pour accepter `variantIds[]`.
    const ids = batchRuns
      .filter((r) => r.phase === "done")
      .map(() => batchAssetId);
    if (ids.length < 2) {
      // Pas assez de variants ready — fallback : ouvrir l'asset shell.
      setStageMode({ mode: "asset", assetId: batchAssetId, variantKind: "video" });
    } else {
      setStageMode({ mode: "asset_compare", assetIds: ids });
    }
    close();
  }, [batchAssetId, batchRuns, setStageMode, close]);

  const isSingleBusy = phase === "creating" || phase === "queued" || phase === "running";
  const isBatchBusy = batchPhase === "creating" || batchPhase === "running";

  const phaseLabel = useMemo(() => {
    if (phase === "creating") return "Création de l'asset…";
    if (phase === "queued") return "Mise en file…";
    if (phase === "running") return progressLabel(progress, provider);
    if (phase === "done") return "Vidéo prête";
    if (phase === "error") return "Échec";
    return "";
  }, [phase, progress, provider]);

  const validBatchCount = batchForms.filter((f) => f.prompt.trim().length > 0).length;

  return (
    <aside
      role="dialog"
      aria-label="Lancement rapide vidéo"
      aria-hidden={!open}
      className="fixed top-0 right-0 h-screen z-50 flex flex-col"
      style={{
        width: "var(--width-quick-launch)",
        maxWidth: "100vw",
        background: "var(--surface-1)",
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
          disabled={isBatchBusy || batchPhase === "done"}
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
          disabled={isSingleBusy || phase === "done"}
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
          <SingleForm
            prompt={prompt}
            setPrompt={setPrompt}
            provider={provider}
            setProvider={setProvider}
            duration={duration}
            setDuration={setDuration}
            ratio={ratio}
            setRatio={setRatio}
            phase={phase}
            progress={progress}
            phaseLabel={phaseLabel}
            errorMsg={errorMsg}
            isBusy={isSingleBusy}
            textareaRef={textareaRef}
          />
        ) : (
          <BatchForms
            forms={batchForms}
            updateForm={updateBatchForm}
            addForm={addBatchForm}
            removeForm={removeBatchForm}
            isBusy={isBatchBusy || batchPhase === "done"}
            runs={batchRuns}
            batchPhase={batchPhase}
            batchError={batchError}
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
          phase === "done" && createdAssetId ? (
            <>
              <Action variant="ghost" tone="neutral" onClick={close}>
                Fermer
              </Action>
              <Action variant="primary" tone="brand" onClick={openAsset}>
                Ouvrir
              </Action>
            </>
          ) : phase === "error" ? (
            <>
              <Action variant="ghost" tone="neutral" onClick={close}>
                Fermer
              </Action>
              <Action
                variant="primary"
                tone="brand"
                onClick={() => {
                  setPhase("idle");
                  setProgress(0);
                  setErrorMsg(null);
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
        ) : batchPhase === "done" ? (
          <>
            <Action variant="ghost" tone="neutral" onClick={close}>
              Fermer
            </Action>
            <Action variant="primary" tone="brand" onClick={openCompare}>
              Comparer les résultats
            </Action>
          </>
        ) : batchPhase === "error" ? (
          <>
            <Action variant="ghost" tone="neutral" onClick={close}>
              Fermer
            </Action>
            <Action
              variant="primary"
              tone="brand"
              onClick={() => {
                setBatchPhase("idle");
                setBatchRuns([]);
                setBatchError(null);
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

// ── Sous-composants ────────────────────────────────────────────────

function SingleForm({
  prompt,
  setPrompt,
  provider,
  setProvider,
  duration,
  setDuration,
  ratio,
  setRatio,
  phase,
  progress,
  phaseLabel,
  errorMsg,
  isBusy,
  textareaRef,
}: {
  prompt: string;
  setPrompt: (v: string) => void;
  provider: Provider;
  setProvider: (v: Provider) => void;
  duration: DurationOption;
  setDuration: (v: DurationOption) => void;
  ratio: RatioOption;
  setRatio: (v: RatioOption) => void;
  phase: SinglePhase;
  progress: number;
  phaseLabel: string;
  errorMsg: string | null;
  isBusy: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const isDone = phase === "done";
  return (
    <>
      {/* Prompt */}
      <label className="flex flex-col" style={{ gap: "var(--space-2)" }}>
        <span className="t-11 font-medium text-text-muted">Prompt</span>
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={isBusy || isDone}
          placeholder="Une caméra qui glisse au-dessus d'une ville futuriste au crépuscule…"
          rows={4}
          className="t-13 font-light text-text bg-[var(--card-flat-bg)] border border-(--border-shell) hover:border-[var(--accent-teal-border-hover)] focus:border-[var(--accent-teal-border-hover)] focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed resize-none"
          style={{ padding: "var(--space-3)", borderRadius: "var(--radius-sm)" }}
        />
      </label>

      {/* Durée */}
      <SegmentedRow<DurationOption>
        label="Durée"
        options={[5, 10]}
        getLabel={(d) => DURATION_LABELS[d]}
        value={duration}
        onChange={setDuration}
        disabled={isBusy || isDone}
      />

      {/* Provider */}
      <SegmentedRow<Provider>
        label="Provider"
        options={["runway", "heygen"]}
        getLabel={(p) => (p === "runway" ? "Runway" : "HeyGen")}
        value={provider}
        onChange={setProvider}
        disabled={isBusy || isDone}
      />

      {/* Ratio (Runway uniquement) */}
      {provider === "runway" && (
        <SegmentedRow<RatioOption>
          label="Format"
          options={["1280:720", "720:1280"]}
          getLabel={(r) => RATIO_LABELS[r]}
          value={ratio}
          onChange={setRatio}
          disabled={isBusy || isDone}
        />
      )}

      {/* Progress bar */}
      {phase !== "idle" && (
        <ProgressBlock
          phase={phase === "done" ? "done" : phase === "error" ? "error" : phase === "running" ? "running" : "queued"}
          progress={progress}
          label={phaseLabel}
          errorMsg={errorMsg}
        />
      )}
    </>
  );
}

function BatchForms({
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
  batchPhase: "idle" | "creating" | "running" | "done" | "error";
  batchError: string | null;
}) {
  // Tant qu'on n'a pas lancé, on affiche les forms éditables. Quand running/
  // done/error, on switch sur la grille de progress cards.
  const showRuns = batchPhase === "creating" || batchPhase === "running" || batchPhase === "done";

  if (showRuns) {
    return <BatchRunGrid runs={runs} batchError={batchError} />;
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
        <BatchVariantField
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

function BatchVariantField({
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
        <span className="t-11 font-medium text-(--accent-teal)">
          Variant {index + 1}
        </span>
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

function BatchRunGrid({
  runs,
  batchError,
}: {
  runs: BatchVariantRun[];
  batchError: string | null;
}) {
  // Stagger 100ms entre les cards (transition-delay).
  const count = runs.length;
  const cols = count >= 4 ? 2 : count === 1 ? 1 : 2;

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
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gap: "var(--space-4)",
        }}
        data-testid="batch-run-grid"
      >
        {runs.map((run, i) => (
          <BatchRunCard key={run.localId} run={run} delayMs={i * 100} />
        ))}
      </div>
    </>
  );
}

function BatchRunCard({ run, delayMs }: { run: BatchVariantRun; delayMs: number }) {
  // Stagger entrée : on démarre invisible/translaté puis on bascule via
  // useEffect pour déclencher la transition CSS standard. Évite de
  // dépendre d'une keyframe globale.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), delayMs);
    return () => clearTimeout(t);
  }, [delayMs]);

  const label = useMemo(() => {
    if (run.phase === "queued") return "Mise en file…";
    if (run.phase === "running") return progressLabel(run.progress, run.form.provider);
    if (run.phase === "done") return "Vidéo prête";
    if (run.phase === "error") return run.errorMsg ?? "Échec";
    return "";
  }, [run.phase, run.progress, run.form.provider, run.errorMsg]);

  const isError = run.phase === "error";
  const isDone = run.phase === "done";
  const displayProgress = isError ? 0 : isDone ? 100 : Math.max(run.progress, run.phase === "running" ? 4 : 0);

  return (
    <div
      data-testid={`batch-run-card-${run.index}`}
      className="flex flex-col"
      style={{
        padding: "var(--space-4)",
        background: "var(--surface-1)",
        border: "1px solid var(--border-shell)",
        borderRadius: "var(--radius-sm)",
        gap: "var(--space-3)",
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateY(0)" : "translateY(8px)",
        transition: "opacity var(--duration-emphasis) var(--ease-out-soft), transform var(--duration-emphasis) var(--ease-out-soft)",
        minWidth: 0,
      }}
    >
      <div className="flex items-center justify-between">
        <span className="t-11 font-medium text-(--accent-teal)">
          Variant {run.index + 1}
        </span>
        <span className="t-11 font-mono tabular-nums text-text-muted">
          {isError ? "—" : `${Math.round(run.progress)}%`}
        </span>
      </div>

      {/* Thumbnail placeholder */}
      <div
        aria-hidden
        style={{
          aspectRatio: run.form.ratio === "720:1280" ? "9/16" : "16/9",
          background: "var(--bg-elev)",
          border: "1px solid var(--surface-2)",
          borderRadius: "var(--radius-xs)",
        }}
      />

      <p
        className="t-11 font-light text-text-muted leading-relaxed"
        style={{
          maxHeight: "var(--space-12)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}
        title={run.form.prompt}
      >
        {run.form.prompt}
      </p>

      <div
        aria-hidden
        style={{
          height: "var(--space-1)",
          background: "var(--bg-elev)",
          borderRadius: "var(--radius-pill)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${displayProgress}%`,
            background: isError ? "var(--danger)" : "var(--accent-teal)",
            transition: "width var(--duration-emphasis) var(--ease-out-soft)",
          }}
        />
      </div>

      <span
        className={`t-11 font-light ${isError ? "text-(--danger)" : "text-text-muted"}`}
      >
        {label}
      </span>
    </div>
  );
}

// ── UI primitives locales ──────────────────────────────────────────

function SegmentedRow<T extends string | number>({
  label,
  options,
  value,
  onChange,
  getLabel,
  disabled,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  getLabel: (v: T) => string;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col" style={{ gap: "var(--space-2)" }}>
      <span className="t-11 font-medium text-text-muted">{label}</span>
      <div className="flex" style={{ gap: "var(--space-2)" }}>
        {options.map((opt) => {
          const active = value === opt;
          return (
            <button
              key={String(opt)}
              type="button"
              onClick={() => onChange(opt)}
              disabled={disabled}
              className={`t-13 font-light transition-colors duration-base disabled:opacity-50 disabled:cursor-not-allowed ${
                active
                  ? "border border-(--accent-teal) text-(--accent-teal) bg-[var(--accent-teal-surface)]"
                  : "border border-(--border-shell) text-text-muted hover:text-text"
              }`}
              style={{
                flex: 1,
                padding: "var(--space-2) var(--space-3)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              {getLabel(opt)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SegmentedInline<T extends string | number>({
  options,
  value,
  onChange,
  getLabel,
  disabled,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  getLabel: (v: T) => string;
  disabled: boolean;
}) {
  return (
    <div className="flex" style={{ gap: "var(--space-1)", flex: 1 }}>
      {options.map((opt) => {
        const active = value === opt;
        return (
          <button
            key={String(opt)}
            type="button"
            onClick={() => onChange(opt)}
            disabled={disabled}
            className={`t-11 font-light transition-colors duration-base disabled:opacity-50 disabled:cursor-not-allowed ${
              active
                ? "border border-(--accent-teal) text-(--accent-teal) bg-[var(--accent-teal-surface)]"
                : "border border-(--border-shell) text-text-muted hover:text-text"
            }`}
            style={{
              flex: 1,
              padding: "var(--space-1) var(--space-2)",
              borderRadius: "var(--radius-xs)",
            }}
          >
            {getLabel(opt)}
          </button>
        );
      })}
    </div>
  );
}

function ProgressBlock({
  phase,
  progress,
  label,
  errorMsg,
}: {
  phase: "queued" | "running" | "done" | "error";
  progress: number;
  label: string;
  errorMsg: string | null;
}) {
  return (
    <div
      className="flex flex-col"
      style={{
        gap: "var(--space-2)",
        padding: "var(--space-4)",
        background: "var(--card-flat-bg)",
        border: "1px solid var(--border-shell)",
        borderRadius: "var(--radius-sm)",
      }}
    >
      <div className="flex items-center justify-between">
        <span className="t-11 font-light text-text-muted">{label}</span>
        <span className="t-11 font-mono tabular-nums text-text-muted">
          {phase === "error" ? "—" : `${Math.round(progress)}%`}
        </span>
      </div>
      <div
        aria-hidden
        style={{
          height: "var(--space-1)",
          background: "var(--surface-1)",
          borderRadius: "var(--radius-pill)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${phase === "error" ? 0 : Math.max(progress, phase === "running" ? 4 : 0)}%`,
            background: phase === "error" ? "var(--danger)" : "var(--accent-teal)",
            transition: "width var(--duration-emphasis) var(--ease-out-soft)",
          }}
        />
      </div>
      {errorMsg && phase === "error" && (
        <p className="t-11 font-light text-(--danger)" style={{ marginTop: "var(--space-1)" }}>
          {errorMsg}
        </p>
      )}
    </div>
  );
}
