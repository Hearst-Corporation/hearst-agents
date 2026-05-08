"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  title: string;
  description: string;
  /** Page handles its own primary CTA (usually `/new`). */
  createHref: string;
  createLabel: string;
  /** Resource name for `POST /api/admin/seed/[resource]`. */
  seedResource: "agents" | "tools" | "datasets" | "workflows" | "skills";
  /** Variant: full-page empty state vs. compact "load more samples" prompt. */
  variant?: "full" | "compact";
}

export default function EmptyState({
  title,
  description,
  createHref,
  createLabel,
  seedResource,
  variant = "full",
}: Props) {
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const onSeed = async () => {
    setSeeding(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/seed/${seedResource}`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Erreur lors du seed");
        setSeeding(false);
        return;
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur réseau");
      setSeeding(false);
    }
  };

  if (variant === "compact") {
    return (
      <div className="flex items-center justify-between gap-(--space-4) px-(--space-4) py-(--space-3) rounded-(--radius-md) border border-line bg-(--surface-1)">
        <p className="t-12 text-text-muted">
          Tu peux générer plus de samples dev pour étoffer cette section.
        </p>
        <button
          type="button"
          onClick={onSeed}
          disabled={seeding}
          className="t-11 font-mono uppercase tracking-(--tracking-wide) px-(--space-3) py-(--space-1) rounded-(--radius-xs) border border-(--cykan)/40 text-(--cykan) hover:bg-(--cykan)/10 transition-colors disabled:opacity-40"
        >
          {seeding ? "Seed en cours…" : "+ samples dev"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-(--space-5) py-(--space-16) px-(--space-6) text-center">
      <span className="size-(--space-16) flex items-center justify-center rounded-(--radius-2xl) bg-(--cykan-bg-active) border border-(--cykan)/30 text-(--cykan)">
        <svg
          className="size-(--space-8)"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </svg>
      </span>
      <div className="flex flex-col gap-(--space-2) max-w-md">
        <h2 className="t-15 font-medium text-text">{title}</h2>
        <p className="t-12 leading-relaxed text-text-muted">{description}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-(--space-3)">
        <Link
          href={createHref}
          className="t-12 font-medium px-(--space-4) py-(--space-2) rounded-(--radius-sm) border border-(--cykan)/50 bg-(--cykan)/10 text-(--cykan) hover:bg-(--cykan)/15 transition-colors"
        >
          {createLabel}
        </Link>
        <button
          type="button"
          onClick={onSeed}
          disabled={seeding}
          className="t-12 px-(--space-4) py-(--space-2) rounded-(--radius-sm) border border-line-strong text-text-muted hover:text-text hover:border-(--cykan)/40 transition-colors disabled:opacity-40"
        >
          {seeding ? "Seed en cours…" : "Charger les données dev"}
        </button>
      </div>
      {error && (
        <p className="t-11 text-(--danger) max-w-md">{error}</p>
      )}
    </div>
  );
}
