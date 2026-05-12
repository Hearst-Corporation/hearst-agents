"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { RunTimeline } from "../../components/RunTimeline";
import { GhostIconChevronRight, ServiceIdGlyph } from "../../components/ghost-icons";
import { PageHeader } from "../../components/PageHeader";
import { Action } from "../../components/ui";
import { usePollingEffect } from "@/app/hooks/use-polling-effect";
import { toast } from "@/app/hooks/use-toast";
import type { RunRecord } from "@/lib/engine/runtime/runs/types";
import type { TimelineItem } from "@/lib/engine/runtime/timeline/types";

export default function RunDetailPage() {
  const params = useParams();
  const router = useRouter();
  const runId = params.id as string;

  const [run, setRun] = useState<RunRecord | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [timelineSource, setTimelineSource] = useState<"memory" | "persistent" | "empty">("empty");
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [rerunning, setRerunning] = useState(false);

  // Track run status locally to avoid including entire run object in effect deps
  const runStatus = run?.status;

  const loadRun = useCallback(async () => {
    try {
      const res = await fetch(`/api/v2/runs/${runId}`);
      if (!res.ok) throw new Error("Failed to load run");
      const data = await res.json();
      setRun(data.run);
      setTimeline(data.timeline || []);
      setTimelineSource(data.timelineSource || "empty");
      const liveStatuses = ["running", "awaiting_approval", "awaiting_clarification"];
      setIsLive(liveStatuses.includes(data.run?.status));
    } catch (error) {
      console.error("Failed to load run:", error);
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadRun();
    });
  }, [loadRun]);

  // Poll only when run is live (running / awaiting_approval / awaiting_clarification)
  const liveStatuses = ["running", "awaiting_approval", "awaiting_clarification"];
  const shouldPoll = !!runStatus && liveStatuses.includes(runStatus);
  usePollingEffect(loadRun, 2000, [runId], { enabled: shouldPoll });

  const handleRerun = useCallback(async () => {
    if (rerunning) return;
    setRerunning(true);
    try {
      const res = await fetch(`/api/v2/runs/${runId}/rerun`, { method: "POST" });
      if (!res.ok) {
        toast.error("Relance impossible", `Erreur serveur (${res.status})`);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { queuedRunId?: string };
      toast.success("Run relancé", "Un nouveau run a été mis en file d'attente");
      if (data.queuedRunId) {
        router.push(`/runs/${data.queuedRunId}`);
      } else {
        await loadRun();
      }
    } catch (err) {
      toast.error(
        "Erreur de relance",
        err instanceof Error ? err.message : "Erreur inconnue",
      );
    } finally {
      setRerunning(false);
    }
  }, [rerunning, runId, router, loadRun]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: "var(--bg-elev)" }}>
        <div className="text-text-muted t-13">Chargement…</div>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8" style={{ background: "var(--bg-elev)" }}>
        <div className="text-text-muted t-13 mb-4">Run non trouvé</div>
        <button
          onClick={() => router.push("/")}
          className="text-(--accent-teal) hover:text-(--accent-teal)/80 t-13"
        >
          Retour à l&apos;accueil
        </button>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    running: "text-(--accent-teal)",
    completed: "text-(--money)",
    failed: "text-(--danger)",
    awaiting_approval: "text-(--warn)",
    awaiting_clarification: "text-text-muted",
  };

  const statusLabels: Record<string, string> = {
    running: "En cours",
    completed: "Terminé",
    failed: "Échoué",
    awaiting_approval: "Validation requise",
    awaiting_clarification: "Précision requise",
  };

  return (
    <div className="flex-1 flex flex-col min-h-0" style={{ background: "var(--bg-elev)" }}>
      <PageHeader
        title={`Run ${run.id.slice(0, 8)}…`}
        subtitle={run.input}
        back={{
          label: "Runs",
          onClick: () => {
            // back() si on a un référent interne, sinon push /runs.
            // window.history.length > 1 ne distingue pas interne/externe,
            // mais pour un user qui arrive sur /runs/[id] depuis un email
            // c'est rare — l'expérience back() reste meilleure.
            if (typeof window !== "undefined" && window.history.length > 1) {
              router.back();
            } else {
              router.push("/runs");
            }
          },
        }}
        actions={
          <>
            <span className={`t-13 font-medium ${statusColors[run.status] || "text-text-muted"}`}>
              {statusLabels[run.status] || run.status}
            </span>
            {(run.status === "failed" || run.status === "completed") && (
              <Action
                variant="primary"
                tone="brand"
                size="sm"
                onClick={handleRerun}
                loading={rerunning}
              >
                Relancer le run
              </Action>
            )}
          </>
        }
      />

      <div className="flex-1 overflow-y-auto px-12 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Timeline */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="t-13 font-medium text-(--text-l1)">
                Timeline
              </h2>
              {timelineSource !== "empty" && (
                <span className="t-9 text-text-faint">
                  {timelineSource === "memory" ? "Live" : "Persisted"}
                </span>
              )}
            </div>
            <div className="border-t border-(--line) p-4 bg-bg">
              <RunTimeline timeline={timeline} isLive={isLive} />
            </div>
          </div>

          {/* Sidebar info */}
          <div className="space-y-4">
            {/* Metrics */}
            {run.metrics && (
              <div className="border-t border-(--line) p-4 bg-bg">
                <h3 className="ghost-meta-label mb-4">Metrics</h3>
                <div className="space-y-2">
                  {run.metrics.tokensIn !== undefined && (
                    <div className="flex justify-between t-13">
                      <span className="text-text-faint">Tokens in</span>
                      <span className="text-text">{run.metrics.tokensIn}</span>
                    </div>
                  )}
                  {run.metrics.tokensOut !== undefined && (
                    <div className="flex justify-between t-13">
                      <span className="text-text-faint">Tokens out</span>
                      <span className="text-text">{run.metrics.tokensOut}</span>
                    </div>
                  )}
                  {run.metrics.costUsd !== undefined && (
                    <div className="flex justify-between t-13">
                      <span className="text-text-faint">Coût</span>
                      <span className="text-text">${run.metrics.costUsd.toFixed(4)}</span>
                    </div>
                  )}
                  {run.metrics.latencyMs !== undefined && (
                    <div className="flex justify-between t-13">
                      <span className="text-text-faint">Latence</span>
                      <span className="text-text">{run.metrics.latencyMs}ms</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Assets */}
            {run.assets && run.assets.length > 0 && (
              <div className="border-t border-(--line) p-4 bg-bg">
                <h3 className="ghost-meta-label mb-4">Assets</h3>
                <div className="divide-y divide-[var(--line)]">
                  {run.assets.map((asset) => (
                    <button
                      type="button"
                      key={asset.id}
                      className="flex w-full items-center gap-3 py-3 text-left hover:bg-[var(--bg-soft)]"
                      onClick={() => router.push(`/assets/${asset.id}`)}
                    >
                      <ServiceIdGlyph id={asset.id} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="t-13 text-text truncate">{asset.name}</p>
                        <p className="t-9 font-light text-text-muted">{asset.type}</p>
                      </div>
                      <GhostIconChevronRight className="w-4 h-4 shrink-0 text-(--accent-teal)" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Info */}
            <div className="border-t border-(--line) p-4 bg-bg">
              <h3 className="ghost-meta-label mb-4">Info</h3>
              <div className="space-y-2 t-13">
                <div className="flex justify-between">
                  <span className="text-text-faint">Backend</span>
                  <span className="text-text">{run.backend || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-faint">Mode</span>
                  <span className="text-text">{run.executionMode || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-faint">Créé</span>
                  <span className="text-text">
                    {new Date(run.createdAt).toLocaleString()}
                  </span>
                </div>
                {run.completedAt && (
                  <div className="flex justify-between">
                    <span className="text-text-faint">Terminé</span>
                    <span className="text-text">
                      {new Date(run.completedAt).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
