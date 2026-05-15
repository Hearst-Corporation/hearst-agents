"use client";

/**
 * /missions/builder — Workflow Builder visuel (Mission Control C3).
 *
 * Layout : canvas plein — Palette + Inspecteur dans le ContextRail (sidebar
 * droite) via useBuilderStore. Handlers enregistrés au mount, nettoyés au
 * unmount.
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/app/hooks/use-toast";
import { getTemplateById, WORKFLOW_TEMPLATES } from "@/lib/workflows/templates";
import type { WorkflowExecutorEvent, WorkflowGraph, WorkflowNode } from "@/lib/workflows/types";
import { createEmptyGraph } from "@/lib/workflows/types";
import { validateGraph } from "@/lib/workflows/validate";
import { useBuilderStore } from "@/stores/builder";
import { PublishTemplateModal } from "../../components/marketplace/PublishTemplateModal";
import { BuilderToolbar } from "../../components/missions/builder/BuilderToolbar";
import type { PaletteEntry } from "../../components/missions/builder/NodePalette";
import { WorkflowCanvas } from "../../components/missions/builder/WorkflowCanvas";
import { PageHeader } from "../../components/PageHeader";

export default function WorkflowBuilderPage() {
  const router = useRouter();
  const registerHandlers = useBuilderStore((s) => s.registerHandlers);
  const clearHandlers = useBuilderStore((s) => s.clearHandlers);
  const setBuilderSelectedNode = useBuilderStore((s) => s.setSelectedNode);

  // Hydratation depuis localStorage : si l'utilisateur a quitté la page avec
  // un graphe dirty au cours des dernières 24h, on le récupère via lazy
  // initializer (pas un effect → conforme à react-hooks/set-state-in-effect).
  const DRAFT_KEY = "hearst:builder:draft";
  const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

  const initialDraft = useState(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      const d = JSON.parse(raw) as { ts: number; graph: WorkflowGraph; missionName: string };
      if (Date.now() - d.ts > DRAFT_TTL_MS) {
        window.localStorage.removeItem(DRAFT_KEY);
        return null;
      }
      if (!d.graph?.nodes?.length) return null;
      return d;
    } catch {
      return null;
    }
  })[0];

  const [graph, setGraph] = useState<WorkflowGraph>(() =>
    initialDraft ? initialDraft.graph : createEmptyGraph(),
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [missionName, setMissionName] = useState(
    () => initialDraft?.missionName ?? "Workflow personnalisé",
  );
  const [draftFlushed, setDraftFlushed] = useState(false);

  // Annonce du restore après mount (toast ne peut pas être dispatché en
  // initializer). Garde de double-toast via ref.
  const restoreToastShownRef = useRef(false);
  useEffect(() => {
    if (initialDraft && !restoreToastShownRef.current) {
      restoreToastShownRef.current = true;
      toast.info(
        "Brouillon restauré",
        `${initialDraft.graph.nodes.length} nodes récupérés depuis ta dernière session.`,
      );
    }
  }, [initialDraft]);
  // Dirty dérivé : un graphe avec ≥1 node ou edge est considéré « en cours ».
  // Forcé à false après save (avant router.push) pour éviter un re-trigger
  // de beforeunload pendant la navigation.
  const isDirty = !draftFlushed && (graph.nodes.length > 0 || graph.edges.length > 0);
  const [showTemplates, setShowTemplates] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [previewSummary, setPreviewSummary] = useState<string | null>(null);
  const [validationCount, setValidationCount] = useState<number | undefined>(undefined);
  const [publishOpen, setPublishOpen] = useState(false);
  const [runStatus, setRunStatus] = useState<Map<string, NodeStatus>>(new Map());

  const selectedNode = graph.nodes.find((n) => n.id === selectedNodeId) ?? null;

  // Sync selected node into the builder store so the ContextRail can display it.
  useEffect(() => {
    setBuilderSelectedNode(selectedNode);
  }, [selectedNode, setBuilderSelectedNode]);

  // Autosave : toutes les 5s on persiste si dirty. Fréquence volontairement
  // basse pour éviter spam + suffisante pour ne pas perdre plus de quelques
  // edits si crash/F5.
  useEffect(() => {
    if (!isDirty) return;
    const tid = window.setInterval(() => {
      try {
        window.localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({ ts: Date.now(), graph, missionName }),
        );
      } catch {
        // Quota dépassé ou localStorage indisponible : on tente plus tard.
      }
    }, 5000);
    return () => window.clearInterval(tid);
  }, [isDirty, graph, missionName]);

  // beforeunload : warning natif si dirty. Le navigateur affiche son propre
  // message (custom string ignoré post-2017), suffisant pour éviter une perte
  // accidentelle (Cmd+W, F5, fermeture onglet).
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const handleAddNode = useCallback((entry: PaletteEntry) => {
    setGraph((prev) => {
      const id = `${entry.kind}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const node: WorkflowNode = {
        id,
        kind: entry.kind,
        label: entry.label,
        config: entry.defaultConfig ?? {},
        position: {
          x: 200 + Math.floor(Math.random() * 200),
          y: 200 + Math.floor(Math.random() * 200),
        },
      };
      return { ...prev, nodes: [...prev.nodes, node] };
    });
  }, []);

  const handleConnect = useCallback((source: string, target: string) => {
    setGraph((prev) => {
      const id = `e_${source}_${target}_${Date.now()}`;
      const exists = prev.edges.some((e) => e.source === source && e.target === target);
      if (exists) return prev;
      return {
        ...prev,
        edges: [...prev.edges, { id, source, target }],
      };
    });
  }, []);

  const handleNodePatch = useCallback(
    (patch: Partial<WorkflowNode>) => {
      if (!selectedNodeId) return;
      setGraph((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) => (n.id === selectedNodeId ? { ...n, ...patch } : n)),
      }));
    },
    [selectedNodeId],
  );

  const handleDeleteNode = useCallback(() => {
    if (!selectedNodeId) return;
    setGraph((prev) => {
      const isStart = prev.startNodeId === selectedNodeId;
      const remainingNodes = prev.nodes.filter((n) => n.id !== selectedNodeId);
      const remainingEdges = prev.edges.filter(
        (e) => e.source !== selectedNodeId && e.target !== selectedNodeId,
      );
      const newStart =
        isStart && remainingNodes.length > 0 ? remainingNodes[0].id : prev.startNodeId;
      return {
        ...prev,
        nodes: remainingNodes,
        edges: remainingEdges,
        startNodeId: newStart,
      };
    });
    setSelectedNodeId(null);
  }, [selectedNodeId]);

  // Expose handlers in the store so the ContextRail can access them.
  useEffect(() => {
    registerHandlers({
      onAdd: handleAddNode,
      onChange: handleNodePatch,
      onDelete: handleDeleteNode,
    });
    return () => clearHandlers();
  }, [registerHandlers, clearHandlers, handleAddNode, handleNodePatch, handleDeleteNode]);

  const handlePositionChange = useCallback((id: string, position: { x: number; y: number }) => {
    setGraph((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => (n.id === id ? { ...n, position } : n)),
    }));
  }, []);

  const handleValidate = useCallback(() => {
    const validation = validateGraph(graph);
    setValidationCount(validation.errors.length);
    if (!validation.valid) {
      toast.error("Graphe invalide", validation.errors.map((e) => e.message).join(" · "));
      return;
    }
    toast.success("Graphe valide", `${graph.nodes.length} nodes`);
  }, [graph]);

  const handlePreview = useCallback(async () => {
    setIsPreviewing(true);
    setPreviewSummary(null);
    setRunStatus(new Map());
    try {
      const res = await fetch("/api/v2/workflows/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ graph }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(
          "Preview impossible",
          (data?.message as string) ?? data?.error ?? `HTTP ${res.status}`,
        );
        return;
      }
      const events = (data.events as WorkflowExecutorEvent[]) ?? [];
      const status = new Map<string, NodeStatus>();
      for (const ev of events) {
        if (ev.type === "step_started") status.set(ev.nodeId, "running");
        else if (ev.type === "step_completed") status.set(ev.nodeId, "completed");
        else if (ev.type === "step_failed") status.set(ev.nodeId, "failed");
        else if (ev.type === "awaiting_approval") status.set(ev.nodeId, "awaiting_approval");
        else if (ev.type === "step_skipped") status.set(ev.nodeId, "skipped");
      }
      setRunStatus(status);
      setPreviewSummary(
        `Preview : ${data.result?.status ?? "?"} · ${data.result?.visitedCount ?? 0} nodes`,
      );
    } catch (err) {
      toast.error("Erreur preview", err instanceof Error ? err.message : String(err));
    } finally {
      setIsPreviewing(false);
    }
  }, [graph]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const validation = validateGraph(graph);
      setValidationCount(validation.errors.length);
      if (!validation.valid) {
        toast.error("Graphe invalide", validation.errors.map((e) => e.message).join(" · "));
        return;
      }

      const res = await fetch("/api/v2/missions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: missionName,
          input: missionName,
          workflowGraph: graph,
          enabled: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error("Enregistrement impossible", (data?.error as string) ?? `HTTP ${res.status}`);
        return;
      }
      toast.success("Workflow enregistré", missionName);
      // Clean draft une fois persisté côté API. Le flag draftFlushedRef force
      // isDirty à false jusqu'au unmount (router.push), évitant un re-trigger
      // de beforeunload pendant la navigation.
      try {
        window.localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* localStorage indispo : peu importe */
      }
      setDraftFlushed(true);
      router.push("/missions");
    } catch (err) {
      toast.error("Erreur d'enregistrement", err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  }, [graph, missionName, router]);

  const handlePickTemplate = useCallback((id: string) => {
    const tpl = getTemplateById(id);
    if (!tpl) return;
    const built = tpl.build();
    setGraph(built);
    setMissionName(tpl.name);
    setSelectedNodeId(null);
    setShowTemplates(false);
    setPreviewSummary(null);
    setRunStatus(new Map());
    toast.info("Template chargé", tpl.name);
  }, []);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-surface">
      <PageHeader
        title="Workflow Builder"
        subtitle="Composer une mission multi-step visuellement"
        breadcrumb={[
          { label: "Hearst", href: "/" },
          { label: "Missions", href: "/missions" },
          { label: "Builder" },
        ]}
        actions={
          <input
            type="text"
            value={missionName}
            onChange={(e) => setMissionName(e.target.value)}
            placeholder="Nom de la mission"
            className="t-13 text-text bg-transparent rounded-md"
            style={{
              padding: "var(--space-2) var(--space-3)",
              border: "1px solid var(--border-soft)",
              minWidth: "240px",
            }}
          />
        }
      />

      <BuilderToolbar
        onOpenTemplates={() => setShowTemplates((v) => !v)}
        onValidate={handleValidate}
        onPreview={handlePreview}
        onSave={handleSave}
        onPublish={() => {
          const validation = validateGraph(graph);
          if (!validation.valid) {
            toast.error("Graphe invalide — corrige avant de publier.");
            return;
          }
          setPublishOpen(true);
        }}
        isBusy={isPreviewing || isSaving}
        saveLabel={isSaving ? "Enregistrement…" : "Enregistrer"}
        validationCount={validationCount}
        previewSummary={previewSummary}
      />

      {publishOpen && (
        <PublishTemplateModal
          open={publishOpen}
          kind="workflow"
          defaultTitle={missionName}
          payload={graph}
          onClose={() => setPublishOpen(false)}
          onPublished={() => {
            toast.success("Workflow publié au marketplace.");
          }}
        />
      )}

      {showTemplates && (
        <div
          className="flex flex-wrap gap-3 border-b border-(--border-shell) bg-surface-1"
          style={{
            padding: "var(--space-3) var(--space-12)",
          }}
        >
          {WORKFLOW_TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => handlePickTemplate(tpl.id)}
              className="flex flex-col gap-1 p-3 text-left rounded-md hover:border-(--accent-teal) transition-colors bg-rail"
              style={{
                border: "1px solid var(--border-soft)",
                minWidth: "240px",
              }}
            >
              <span className="t-13 text-text">{tpl.name}</span>
              <span className="t-9 text-text-muted">{tpl.description}</span>
            </button>
          ))}
        </div>
      )}

      {/* Workflow Builder = canvas Cytoscape, pas adaptable mobile.
          On affiche un message dédié < lg pour économiser le travail visuel. */}
      <div className="flex-1 lg:hidden flex items-center justify-center p-8">
        <div
          className="flex flex-col items-center text-center gap-3 p-8 bg-surface-1"
          style={{
            maxWidth: "var(--width-actions)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-md)",
          }}
        >
          <span className="t-11 font-medium text-(--accent-teal)">Vue desktop</span>
          <h2 className="t-15 text-text">Builder de workflow optimisé pour ordinateur</h2>
          <p className="t-13 text-text-muted">
            Cette vue utilise un canvas graphique pour composer les missions multi-step. Ouvre-la
            sur ordinateur pour la meilleure expérience.
          </p>
        </div>
      </div>

      <div className="flex-1 hidden lg:block min-h-0 overflow-hidden">
        <WorkflowCanvas
          graph={graph}
          selectedNodeId={selectedNodeId}
          onSelect={setSelectedNodeId}
          onConnect={handleConnect}
          onPositionChange={handlePositionChange}
          runStatus={runStatus}
        />
      </div>
    </div>
  );
}

type NodeStatus = "running" | "completed" | "failed" | "awaiting_approval" | "skipped";
