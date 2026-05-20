"use client";

/**
 * <SeedEmptyState> — empty state admin avec primary CTA (create) + secondary CTA (seed dev).
 *
 * Spécifique aux ressources admin qui exposent `POST /api/admin/seed/[resource]`.
 * Construit au-dessus de la primitive user `<EmptyState>` (mêmes tokens, même voix éditoriale).
 *
 * Variantes :
 *   - "full" (default) : empty page complète, primary "Créer" + secondary "Charger samples dev"
 *   - "compact"        : prompt compact en ligne, secondary seed uniquement
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EmptyState } from "@/app/(user)/components/ui/EmptyState";
import { toast } from "@/app/hooks/use-toast";

export type SeedResource = "agents" | "tools" | "datasets" | "workflows" | "skills";

interface Props {
  title: string;
  description: string;
  /** Page handles its own primary CTA (usually `/new`). */
  createHref: string;
  createLabel: string;
  /** Resource name for `POST /api/admin/seed/[resource]`. */
  seedResource: SeedResource;
  /** Variant: full-page empty state vs. compact "load more samples" prompt. */
  variant?: "full" | "compact";
}

export default function SeedEmptyState({
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
      toast.success("Données générées.");
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
          className="t-12 font-medium px-(--space-3) py-(--space-1) rounded-(--radius-xs) border border-(--accent-teal)/40 text-(--accent-teal) hover:bg-(--accent-teal)/10 transition-colors disabled:opacity-40"
        >
          {seeding ? "Seed en cours…" : "+ samples dev"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-(--space-4)">
      <EmptyState title={title} description={description} />
      <div className="flex flex-wrap items-center justify-center gap-(--space-3)">
        <Link
          href={createHref}
          className="t-12 font-medium px-(--space-4) py-(--space-2) rounded-(--radius-sm) border border-(--accent-teal)/50 bg-(--accent-teal)/10 text-(--accent-teal) hover:bg-(--accent-teal)/15 transition-colors"
        >
          {createLabel}
        </Link>
        <button
          type="button"
          onClick={onSeed}
          disabled={seeding}
          className="t-12 px-(--space-4) py-(--space-2) rounded-(--radius-sm) border border-line-strong text-text-muted hover:text-text hover:border-(--accent-teal)/40 transition-colors disabled:opacity-40"
        >
          {seeding ? "Seed en cours…" : "Charger les données dev"}
        </button>
      </div>
      {error && <p className="t-11 text-(--danger) max-w-md">{error}</p>}
    </div>
  );
}
