"use client";

import Link from "next/link";

interface AgentCardProps {
  agent: {
    id: string;
    slug: string;
    name: string;
    description?: string | null;
    model_provider?: string | null;
  };
}

export default function AgentCard({ agent }: AgentCardProps) {
  return (
    <Link
      href={`/admin/agents/${agent.id}`}
      className="block rounded-(--radius-md) border border-(--border-shell) bg-(--surface-1) p-(--space-4) transition-colors hover:border-(--accent-teal-border-hover) hover:bg-(--surface-2)"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-text">{agent.name}</h3>
        <span className="t-10 font-mono tracking-(--tracking-wide) text-text-faint">
          {agent.model_provider}
        </span>
      </div>
      {agent.description && (
        <p className="mt-2 t-13 font-normal text-text-muted line-clamp-2">{agent.description}</p>
      )}
    </Link>
  );
}
