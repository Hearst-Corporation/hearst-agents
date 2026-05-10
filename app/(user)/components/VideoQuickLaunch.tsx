"use client";

/**
 * VideoQuickLaunch — Panel latéral ⌘G (S2-A).
 *
 * Génère une vidéo en 2 gestes : prompt + provider + Generate. La progression
 * du worker `video-gen` (BullMQ) est streamée en temps réel via SSE depuis
 * `/api/v2/jobs/[jobId]/progress` — l'utilisateur voit chaque étape (Runway
 * tâche soumise, polling, upload R2, persistance) plutôt qu'un poll naïf 4s.
 *
 * Flow :
 *   1. POST /api/v2/assets — crée un asset shell de type "report" (placeholder)
 *   2. POST /api/v2/assets/[id]/variants kind=video — enqueue le job
 *   3. EventSource /api/v2/jobs/[jobId]/progress?kind=video-gen — stream
 *   4. completed → bouton "Ouvrir" qui setStageMode mode=asset assetId=…
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

type Phase = "idle" | "creating" | "queued" | "running" | "done" | "error";

const DURATION_LABELS: Record<DurationOption, string> = {
  5: "5 sec",
  10: "10 sec",
};

const RATIO_LABELS: Record<RatioOption, string> = {
  "1280:720": "Paysage",
  "720:1280": "Portrait",
};

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

export function VideoQuickLaunch() {
  const open = useVideoQuickLaunchStore((s) => s.open);
  const close = useVideoQuickLaunchStore((s) => s.close);
  const setStageMode = useStageStore((s) => s.setMode);

  // Form state — reset à chaque close.
  const [prompt, setPrompt] = useState("");
  const [provider, setProvider] = useState<Provider>("runway");
  const [duration, setDuration] = useState<DurationOption>(5);
  const [ratio, setRatio] = useState<RatioOption>("1280:720");

  // Pipeline state.
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createdAssetId, setCreatedAssetId] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Reset complet quand le panel se ferme.
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
  }, []);

  // ESC pour fermer ; auto-focus textarea quand le panel s'ouvre.
  useEffect(() => {
    if (!open) {
      // Petit délai : laisser l'animation slide-out finir avant de reset.
      const t = setTimeout(resetAll, 250);
      return () => clearTimeout(t);
    }
    // Focus le textarea après la transition d'entrée.
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

  // Cleanup EventSource au unmount.
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

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
          // On ignore label côté serveur (rarement présent), on rebuild côté client.
          void providerUsed;
        } catch {
          // payload malformé — ignore
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
        // EventSource retry automatiquement ; on logge sans escalader.
        // Si la connexion tombe définitivement, le poll fallback côté
        // serveur a déjà émis completed/failed avant la chute.
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
      // 1. Create asset shell (kind=text avec un nom dérivé du prompt).
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

      // 2. Enqueue video variant.
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

      // 3. Subscribe SSE progress.
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

  const isBusy = phase === "creating" || phase === "queued" || phase === "running";
  const phaseLabel = useMemo(() => {
    if (phase === "creating") return "Création de l'asset…";
    if (phase === "queued") return "Mise en file…";
    if (phase === "running") return progressLabel(progress, provider);
    if (phase === "done") return "Vidéo prête";
    if (phase === "error") return "Échec";
    return "";
  }, [phase, progress, provider]);

  // Le panel est toujours rendu (pour permettre la transition slide), mais
  // pointer-events:none + visibility:hidden quand fermé pour ne pas
  // intercepter les clics ni rester accessible au focus.
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
          <span className="t-15 font-medium text-text">Vidéo rapide</span>
          <span className="t-11 font-light text-text-muted">⌘G — prompt + provider + go</span>
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

      {/* Form / Progress body */}
      <div
        className="flex-1 flex flex-col overflow-y-auto"
        style={{ padding: "var(--space-6)", gap: "var(--space-5)" }}
      >
        {/* Prompt */}
        <label className="flex flex-col" style={{ gap: "var(--space-2)" }}>
          <span className="t-11 font-medium text-text-muted">Prompt</span>
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isBusy || phase === "done"}
            placeholder="Une caméra qui glisse au-dessus d'une ville futuriste au crépuscule…"
            rows={4}
            className="t-13 font-light text-text bg-[var(--card-flat-bg)] border border-(--border-shell) hover:border-[var(--accent-teal-border-hover)] focus:border-[var(--accent-teal-border-hover)] focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed resize-none"
            style={{ padding: "var(--space-3)", borderRadius: "var(--radius-sm)" }}
          />
        </label>

        {/* Durée */}
        <div className="flex flex-col" style={{ gap: "var(--space-2)" }}>
          <span className="t-11 font-medium text-text-muted">Durée</span>
          <div className="flex" style={{ gap: "var(--space-2)" }}>
            {([5, 10] as const).map((d) => {
              const active = duration === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
                  disabled={isBusy || phase === "done"}
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
                  {DURATION_LABELS[d]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Provider */}
        <div className="flex flex-col" style={{ gap: "var(--space-2)" }}>
          <span className="t-11 font-medium text-text-muted">Provider</span>
          <div className="flex" style={{ gap: "var(--space-2)" }}>
            {(["runway", "heygen"] as const).map((p) => {
              const active = provider === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setProvider(p)}
                  disabled={isBusy || phase === "done"}
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
                  {p === "runway" ? "Runway" : "HeyGen"}
                </button>
              );
            })}
          </div>
        </div>

        {/* Ratio (Runway uniquement) */}
        {provider === "runway" && (
          <div className="flex flex-col" style={{ gap: "var(--space-2)" }}>
            <span className="t-11 font-medium text-text-muted">Format</span>
            <div className="flex" style={{ gap: "var(--space-2)" }}>
              {(["1280:720", "720:1280"] as const).map((r) => {
                const active = ratio === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRatio(r)}
                    disabled={isBusy || phase === "done"}
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
                    {RATIO_LABELS[r]}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Progress bar (visible si phase != idle) */}
        {phase !== "idle" && (
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
              <span className="t-11 font-light text-text-muted">{phaseLabel}</span>
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
                  background:
                    phase === "error" ? "var(--danger)" : "var(--accent-teal)",
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
        {phase === "done" && createdAssetId ? (
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
            loading={isBusy}
            disabled={!prompt.trim()}
          >
            Générer la vidéo
          </Action>
        )}
      </footer>
    </aside>
  );
}
