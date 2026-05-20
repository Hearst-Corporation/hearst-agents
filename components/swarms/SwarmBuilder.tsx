"use client";

// NOTE: react-hook-form and @hookform/resolvers are NOT in Helm's dependencies.
// SwarmBuilder has been adapted to use plain React state instead of useForm.
// The Zod schema is still used for type inference only.

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { type BuilderTabId, parseBuilderTab } from "@/lib/swarms/builderTabs";
import {
  type AgentInput,
  type SwarmInput,
  type SwarmInputRaw,
  type SwarmSpecResponse,
  type TaskInput,
  type Tool,
  type ToolBindingInput,
} from "@/lib/types/swarm";
import { FONT, FONT_WEIGHT, LETTER_SPACING, RADIUS, SIZE, SPACING } from "@/lib/ui/tokens";
import { isValidUuid } from "@/lib/utils/uuid";
import { ArchitectModal } from "./ArchitectModal";
import { BuilderAgentsTab } from "./BuilderAgentsTab";
import { BuilderTasksTab } from "./BuilderTasksTab";
import { BuilderToolsTab } from "./BuilderToolsTab";

type BuilderMode = "create" | "edit";

interface SwarmBuilderProps {
  mode: BuilderMode;
  swarmId?: string;
  initialSwarm?: SwarmInputRaw;
  availableTools?: Tool[];
}

const EMPTY_SWARM: SwarmInputRaw = {
  name: "",
  description: "",
  version: 1,
  config_json: {},
  is_active: true,
  is_template: false,
  agents: [],
  tasks: [],
  tool_bindings: [],
};

function generateLocalId(): string {
  return crypto.randomUUID();
}

export function SwarmBuilder({
  mode,
  swarmId,
  initialSwarm,
  availableTools = [],
}: SwarmBuilderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab: BuilderTabId = parseBuilderTab(searchParams.get("tab"));

  const init = initialSwarm ?? EMPTY_SWARM;

  const [name, setName] = useState(init.name ?? "");
  const [description, setDescription] = useState(init.description ?? "");
  const [isActive, setIsActive] = useState(init.is_active ?? true);
  const [isTemplate, setIsTemplate] = useState(init.is_template ?? false);
  const [nameError, setNameError] = useState<string | null>(null);

  const [agents, setAgents] = useState<AgentInput[]>((init.agents ?? []) as AgentInput[]);
  const [tasks, setTasks] = useState<TaskInput[]>((init.tasks ?? []) as TaskInput[]);
  const [toolBindings, setToolBindings] = useState<ToolBindingInput[]>(
    (init.tool_bindings ?? []) as ToolBindingInput[],
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [architectOpen, setArchitectOpen] = useState(false);
  const [architectKey, setArchitectKey] = useState(0);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setNameError(null);

    if (!name.trim() || name.trim().length < 2) {
      setNameError("Name is required (min 2 characters).");
      return;
    }
    if (agents.length === 0) {
      setSubmitError("At least 1 agent required to create a swarm.");
      return;
    }
    if (tasks.length === 0) {
      setSubmitError("At least 1 task required to create a swarm.");
      return;
    }

    setSubmitting(true);
    const payload: SwarmInput = {
      name: name.trim(),
      description: description ?? "",
      version: 1,
      config_json: {},
      is_active: isActive,
      is_template: isTemplate,
      agents,
      tasks,
      tool_bindings: toolBindings,
    };

    try {
      const url = mode === "create" ? "/api/crewai/v1/swarms" : `/api/crewai/v1/swarms/${swarmId}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => res.statusText);
        throw new Error(`${res.status} — ${body}`);
      }
      const saved = (await res.json()) as { id: string };
      router.push(`/swarms/${saved.id}`);
      router.refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Agent mutations ──────────────────────────────────────────────────────
  const addAgent = (agent: AgentInput) => {
    const withId: AgentInput = { ...agent, id: agent.id ?? generateLocalId() };
    setAgents((prev) => [...prev, withId]);
  };
  const updateAgent = (idx: number, agent: AgentInput) =>
    setAgents((prev) => prev.map((a, i) => (i === idx ? agent : a)));
  const removeAgent = (idx: number) => setAgents((prev) => prev.filter((_, i) => i !== idx));

  // ── Task mutations ────────────────────────────────────────────────────────
  const addTask = (task: TaskInput) => {
    const withId: TaskInput = { ...task, id: task.id ?? generateLocalId() };
    setTasks((prev) => [...prev, withId]);
  };
  const updateTask = (idx: number, task: TaskInput) =>
    setTasks((prev) => prev.map((t, i) => (i === idx ? task : t)));
  const removeTask = (idx: number) => setTasks((prev) => prev.filter((_, i) => i !== idx));

  // ── Architect Agent ────────────────────────────────────────────────────────
  const onGenerated = (spec: SwarmSpecResponse) => {
    if (mode === "edit") {
      const ok = window.confirm(
        "Replace the current builder content with the generated spec? Unsaved changes will be lost.",
      );
      if (!ok) return;
    }

    const specAgents = spec.agents ?? [];
    const specTasks = spec.tasks ?? [];
    const specBindings = spec.tool_bindings ?? [];

    const agentIdMap = new Map<string, string>();
    const nextAgents: AgentInput[] = specAgents.map((a) => {
      const oldId = a.id;
      const newId = oldId && isValidUuid(oldId) ? oldId : generateLocalId();
      if (oldId) agentIdMap.set(oldId, newId);
      return { ...a, id: newId } as AgentInput;
    });
    const resolvedAgents = nextAgents.map((a) => ({
      ...a,
      parent_agent_id:
        a.parent_agent_id && agentIdMap.has(a.parent_agent_id)
          ? agentIdMap.get(a.parent_agent_id)!
          : (a.parent_agent_id ?? null),
    }));

    const taskIdMap = new Map<string, string>();
    const nextTasks: TaskInput[] = specTasks.map((t) => {
      const oldId = t.id;
      const newId = oldId && isValidUuid(oldId) ? oldId : generateLocalId();
      if (oldId) taskIdMap.set(oldId, newId);
      return { ...t, id: newId } as TaskInput;
    });
    const resolvedTasks = nextTasks.map((t) => ({
      ...t,
      agent_id: t.agent_id && agentIdMap.has(t.agent_id) ? agentIdMap.get(t.agent_id)! : t.agent_id,
      depends_on_task_id:
        t.depends_on_task_id && taskIdMap.has(t.depends_on_task_id)
          ? taskIdMap.get(t.depends_on_task_id)!
          : (t.depends_on_task_id ?? null),
    }));

    const resolvedBindings: ToolBindingInput[] = specBindings.map((b) => ({
      ...b,
      id: b.id && isValidUuid(b.id) ? b.id : generateLocalId(),
      agent_id: b.agent_id && agentIdMap.has(b.agent_id) ? agentIdMap.get(b.agent_id)! : b.agent_id,
    }));

    setAgents(resolvedAgents);
    setTasks(resolvedTasks);
    setToolBindings(resolvedBindings);
    setName(spec.name ?? "");
    setDescription(spec.description ?? "");
    setIsActive(spec.is_active ?? true);
    setIsTemplate(spec.is_template ?? false);
    setSubmitError(null);
  };

  const previewJson = useMemo(() => {
    const snapshot = {
      name,
      description,
      is_active: isActive,
      is_template: isTemplate,
      agents,
      tasks,
      tool_bindings: toolBindings,
    };
    return JSON.stringify(snapshot, null, 2);
  }, [name, description, isActive, isTemplate, agents, tasks, toolBindings]);

  return (
    <form onSubmit={onSubmit}>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: SPACING.md,
          flexWrap: "wrap",
          marginBottom: SPACING.xl,
        }}
      >
        <button
          type="button"
          className="ct-seg-btn primary"
          onClick={() => {
            setArchitectKey((k) => k + 1);
            setArchitectOpen(true);
          }}
          disabled={submitting}
        >
          ✨ Generate with AI
        </button>
      </div>

      <ArchitectModal
        key={architectKey}
        open={architectOpen}
        onClose={() => setArchitectOpen(false)}
        onGenerated={onGenerated}
      />

      {activeTab === "overview" && (
        <div
          role="tabpanel"
          id="swarm-panel-overview"
          aria-labelledby="swarm-tab-overview"
          tabIndex={0}
          className="ct-card"
        >
          <div className="ct-card-title">Identity</div>
          <div style={{ display: "flex", flexDirection: "column", gap: SPACING.lg }}>
            <label style={labelStyle}>
              <span style={labelText}>Swarm name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameError(null);
                }}
                style={inputStyle}
                placeholder="e.g. Daily Inbox Triage"
              />
              {nameError ? <span style={errorStyle}>{nameError}</span> : null}
            </label>

            <label style={labelStyle}>
              <span style={labelText}>Description</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                style={{ ...inputStyle, resize: "vertical" }}
                placeholder="What is this swarm for?"
              />
            </label>

            <div style={{ display: "flex", gap: SPACING.lg, flexWrap: "wrap" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: SPACING.sm,
                  fontSize: FONT.base,
                  color: "var(--ct-text-primary)",
                }}
              >
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                Active (triggerable)
              </label>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: SPACING.sm,
                  fontSize: FONT.base,
                  color: "var(--ct-text-primary)",
                }}
              >
                <input
                  type="checkbox"
                  checked={isTemplate}
                  onChange={(e) => setIsTemplate(e.target.checked)}
                />
                Template
              </label>
            </div>
          </div>
        </div>
      )}

      {activeTab === "agents" && (
        <div
          role="tabpanel"
          id="swarm-panel-agents"
          aria-labelledby="swarm-tab-agents"
          tabIndex={0}
        >
          <BuilderAgentsTab
            agents={agents}
            onAdd={addAgent}
            onUpdate={updateAgent}
            onRemove={removeAgent}
          />
        </div>
      )}

      {activeTab === "tasks" && (
        <div role="tabpanel" id="swarm-panel-tasks" aria-labelledby="swarm-tab-tasks" tabIndex={0}>
          <BuilderTasksTab
            agents={agents}
            tasks={tasks}
            onAdd={addTask}
            onUpdate={updateTask}
            onRemove={removeTask}
          />
        </div>
      )}

      {activeTab === "tools" && (
        <div role="tabpanel" id="swarm-panel-tools" aria-labelledby="swarm-tab-tools" tabIndex={0}>
          <BuilderToolsTab
            availableTools={availableTools}
            toolBindings={toolBindings}
            agents={agents}
            onChange={setToolBindings}
          />
        </div>
      )}

      {activeTab === "preview" && (
        <div
          role="tabpanel"
          id="swarm-panel-preview"
          aria-labelledby="swarm-tab-preview"
          tabIndex={0}
          className="ct-card"
        >
          <div className="ct-card-title">JSON Preview</div>
          <pre
            style={{
              background: "var(--ct-surface-2)",
              border: "1px solid var(--ct-border)",
              borderRadius: RADIUS.md,
              padding: SPACING.md,
              fontSize: FONT.sm,
              color: "var(--ct-text-primary)",
              fontFamily: "var(--font-mono)",
              overflow: "auto",
              maxHeight: SIZE.previewMaxH,
            }}
          >
            {previewJson}
          </pre>
        </div>
      )}

      {submitError ? (
        <div
          role="alert"
          aria-live="assertive"
          className="ct-card"
          style={{
            borderColor: "var(--ct-border-accent)",
            background: "var(--ct-accent-soft)",
          }}
        >
          <div className="ct-card-title">Error</div>
          <p className="ct-card-body">{submitError}</p>
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          gap: SPACING.sm,
          justifyContent: "flex-end",
          marginTop: SPACING.xl,
        }}
      >
        <button
          type="button"
          className="ct-seg-btn"
          onClick={() => router.push("/swarms")}
          disabled={submitting}
        >
          Cancel
        </button>
        <button type="submit" className="ct-seg-btn primary" disabled={submitting}>
          {submitting ? "Saving…" : mode === "create" ? "Create swarm" : "Save"}
        </button>
      </div>
    </form>
  );
}

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: SPACING.xxs,
};
const labelText: React.CSSProperties = {
  fontSize: FONT.xs,
  fontWeight: FONT_WEIGHT.semibold,
  letterSpacing: LETTER_SPACING.tight,
  textTransform: "uppercase",
  color: "var(--ct-text-muted)",
};
const inputStyle: React.CSSProperties = {
  background: "var(--ct-surface-2)",
  border: "1px solid var(--ct-border)",
  borderRadius: RADIUS.md,
  padding: `${SPACING.s}px ${SPACING.md}px`,
  color: "var(--ct-text-primary)",
  fontSize: FONT.base,
  fontFamily: "inherit",
  outline: "none",
};
const errorStyle: React.CSSProperties = {
  fontSize: FONT.xs,
  color: "var(--ct-accent-strong)",
};
