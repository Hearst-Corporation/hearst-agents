"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { SwarmBuilder } from "@/components/swarms/SwarmBuilder";
import type { SwarmRecord, Tool } from "@/components/swarms/types";
import type { SwarmInputRaw } from "@/lib/types/swarm";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EditSwarmPage({ params }: PageProps) {
  const { id } = use(params);
  const [swarm, setSwarm] = useState<SwarmRecord | null>(null);
  const [tools, setTools] = useState<Tool[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [swarmRes, toolsRes] = await Promise.all([
          fetch(`/api/crewai/v1/swarms/${id}`),
          fetch("/api/crewai/v1/tools").catch(() => null),
        ]);
        if (!swarmRes.ok) {
          throw new Error(`Failed to load swarm: ${swarmRes.status}`);
        }
        const swarmData = (await swarmRes.json()) as SwarmRecord;
        if (cancelled) return;
        setSwarm(swarmData);

        if (toolsRes?.ok) {
          const toolsData = (await toolsRes.json()) as { tools?: Tool[] } | Tool[];
          if (!cancelled) {
            const arr = Array.isArray(toolsData)
              ? toolsData
              : ((toolsData as { tools?: Tool[] }).tools ?? []);
            setTools(arr);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="h-full min-h-0 overflow-y-auto bg-bg text-text">
        <div className="px-(--space-8) pt-(--space-8) pb-(--space-4) border-b border-(--line)">
          <div className="t-10 font-mono uppercase tracking-(--tracking-stretch) text-text-faint mb-(--space-2)">
            <Link
              href="/admin/orchestrator/swarms"
              className="text-text-muted hover:text-text transition-colors no-underline"
            >
              ← Swarms
            </Link>
          </div>
        </div>
        <div className="px-(--space-8) py-(--space-6)">
          <div className="rounded-(--radius-md) bg-surface-1 border border-(--line) p-(--space-5) flex flex-col gap-(--space-3)">
            <div
              className="h-6 bg-surface-2 rounded-(--radius-md) animate-pulse"
              style={{ width: "40%" }}
            />
            <div
              className="h-4 bg-surface-2 rounded-(--radius-sm) animate-pulse"
              style={{ width: "60%" }}
            />
            <div className="h-32 bg-surface-2 rounded-(--radius-sm) animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !swarm) {
    return (
      <div className="h-full min-h-0 overflow-y-auto bg-bg text-text">
        <div className="px-(--space-8) pt-(--space-8) pb-(--space-4) border-b border-(--line)">
          <div className="t-10 font-mono uppercase tracking-(--tracking-stretch) text-text-faint mb-(--space-2)">
            <Link
              href="/admin/orchestrator/swarms"
              className="text-text-muted hover:text-text transition-colors no-underline"
            >
              ← Swarms
            </Link>
          </div>
          <h2 className="t-24 font-light text-text">Edit swarm</h2>
        </div>
        <div className="px-(--space-8) py-(--space-6)">
          <div className="rounded-(--radius-md) bg-(--danger-surface) border border-(--danger) p-(--space-5)">
            <p className="t-13 text-(--danger)">Edit failed</p>
            <p className="t-12 text-text-muted mt-(--space-1)">{error ?? "Swarm not found."}</p>
          </div>
        </div>
      </div>
    );
  }

  // Normalise null agent_id → "" so the builder can validate
  // Cast en `SwarmInputRaw` shape attendu (le backend renvoie SwarmRecord, on adapte).
  const initialSwarm: SwarmInputRaw = {
    id: swarm.id,
    name: swarm.name,
    description: swarm.description ?? "",
    version: swarm.version,
    config_json: swarm.config_json,
    is_active: swarm.is_active,
    is_template: swarm.is_template,
    agents: swarm.agents,
    tasks: swarm.tasks.map((t) => ({
      id: t.id,
      agent_id: t.agent_id ?? "",
      name: t.name ?? "",
      description: t.description ?? "",
      expected_output: t.expected_output ?? "",
      depends_on_task_id: t.depends_on_task_id ?? null,
      position_x: t.position_x,
      position_y: t.position_y,
    })),
    tool_bindings: swarm.tool_bindings.map((b) => ({
      ...b,
      agent_id: b.agent_id ?? "",
    })),
  };

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-bg text-text">
      <div className="px-(--space-8) pt-(--space-8) pb-(--space-4) border-b border-(--line)">
        <div className="t-10 font-mono uppercase tracking-(--tracking-stretch) text-text-faint mb-(--space-2)">
          <Link
            href={`/admin/orchestrator/swarms/${id}`}
            className="text-text-muted hover:text-text transition-colors no-underline"
          >
            ← {swarm.name}
          </Link>
        </div>
        <h2 className="t-24 font-light text-text">Edit swarm</h2>
        <p className="t-12 text-text-muted mt-(--space-1)">
          Edit name, agents, tasks and linked tools.
        </p>
      </div>

      <div className="px-(--space-8) py-(--space-6)">
        <SwarmBuilder mode="edit" swarmId={id} initialSwarm={initialSwarm} availableTools={tools} />
      </div>
    </div>
  );
}
