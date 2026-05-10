"use client";

interface ModelBadgeProps {
  provider: string;
  model: string;
}

export default function ModelBadge({ provider, model }: ModelBadgeProps) {
  return (
    <span className="inline-flex items-center px-(--space-2) py-(--space-1) rounded-(--radius-xs) t-10 bg-surface-2 text-text-muted font-mono">
      {provider}: {model}
    </span>
  );
}
