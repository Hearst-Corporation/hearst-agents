import fs from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";
import { BackLink } from "@/app/admin/_components/BackLink";

export const dynamic = "force-dynamic";

interface FeatureEntry {
  id: string;
  file: string;
  href: string;
  statut: string;
  statutRaw: string;
  version: string | null;
  owner: string | null;
  derniereRevue: string | null;
  niveau: string | null;
  invariantsCount: number;
  invariantsTitles: string[];
  testsExistantsCount: number;
  testsManquantsCount: number;
  testGap: string;
  orphansCount: number;
}

interface Manifest {
  generatedAt: string;
  total: number;
  counts: Record<string, number>;
  totals: { invariants: number; testsExistants: number; testsManquants: number; orphans: number };
  features: FeatureEntry[];
}

const STATUT_STYLES: Record<string, string> = {
  verrouillé: "bg-(--money)/10 text-money border-(--money)/30",
  in_progress: "bg-(--warn)/10 text-warn border-(--warn)/30",
  review: "bg-(--surface-2) text-text-muted border-line",
  active: "bg-(--accent-teal-bg-active) text-(--accent-teal) border-(--accent-teal)/30",
  legacy: "bg-(--danger)/10 text-danger border-(--danger)/30",
};

const STATUT_LABELS: Record<string, string> = {
  verrouillé: "Verrouillé",
  in_progress: "En cours",
  review: "En revue",
  active: "Actif",
  legacy: "Legacy",
};

const NIVEAU_STYLES: Record<string, string> = {
  P0: "text-danger",
  P1: "text-warn",
  P2: "text-text-muted",
};

const TEST_GAP_STYLES: Record<string, string> = {
  élevé: "text-danger",
  moyen: "text-warn",
  faible: "text-money",
  aucun: "text-text-ghost",
};

export default async function FeatureDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Lire le manifest
  let manifest: Manifest | null = null;
  try {
    const manifestPath = path.join(process.cwd(), "docs", "features", "_manifest.json");
    const raw = await fs.readFile(manifestPath, "utf-8");
    manifest = JSON.parse(raw) as Manifest;
  } catch {
    // manifest absent, on affiche quand même la spec si trouvée
  }

  const feature = manifest?.features.find((f) => f.id === id) ?? null;

  // Lire la spec markdown brute
  let specContent: string | null = null;
  try {
    const specPath = path.join(process.cwd(), "docs", "features", `${id}.md`);
    specContent = await fs.readFile(specPath, "utf-8");
  } catch {
    if (!feature) notFound();
  }

  const statutCls = feature
    ? (STATUT_STYLES[feature.statut] ?? "bg-(--surface-2) text-text-muted border-line")
    : "";
  const niveauCls = feature?.niveau
    ? (NIVEAU_STYLES[feature.niveau] ?? "text-text-muted")
    : "text-text-ghost";
  const gapCls = feature ? (TEST_GAP_STYLES[feature.testGap] ?? "text-text-faint") : "";

  return (
    <div className="p-(--space-8) space-y-(--space-8) text-text-soft h-full overflow-y-auto">
      {/* Retour */}
      <BackLink href="/admin/agent-driven-dev" label="Retour Agent Driven Dev" />

      {/* Header */}
      <div className="space-y-(--space-4)">
        <div className="flex flex-wrap items-center gap-(--space-3)">
          <h1 className="t-28 font-light text-text font-mono">{id}</h1>
          {feature && (
            <>
              <span
                className={`inline-flex items-center px-(--space-2) py-(--space-1) rounded-(--radius-sm) border t-10 font-medium ${statutCls}`}
                title={feature.statutRaw}
              >
                {STATUT_LABELS[feature.statut] ?? feature.statut}
              </span>
              {feature.niveau && (
                <span className={`t-13 font-medium ${niveauCls}`}>{feature.niveau}</span>
              )}
            </>
          )}
        </div>

        {feature && (
          <div className="flex flex-wrap items-center gap-(--space-4) t-12 text-text-muted">
            {feature.version && (
              <span>
                <span className="text-text-ghost">Version</span>{" "}
                <span className="font-mono">v{feature.version}</span>
              </span>
            )}
            {feature.owner && (
              <span>
                <span className="text-text-ghost">Owner</span> {feature.owner}
              </span>
            )}
            {feature.derniereRevue && (
              <span>
                <span className="text-text-ghost">Dernière revue</span> {feature.derniereRevue}
              </span>
            )}
          </div>
        )}
      </div>

      {/* KPIs */}
      {feature && (
        <div className="grid gap-(--space-4) sm:grid-cols-3">
          <div className="rounded-(--radius-md) bg-surface-1 border border-(--border-shell) p-(--space-4) flex flex-col gap-(--space-1)">
            <span className="t-11 font-medium text-text-faint">Invariants</span>
            <span className="t-24 font-light text-text">{feature.invariantsCount}</span>
            <span className="t-10 text-text-ghost">règles figées</span>
          </div>
          <div className="rounded-(--radius-md) bg-surface-1 border border-(--border-shell) p-(--space-4) flex flex-col gap-(--space-1)">
            <span className="t-11 font-medium text-text-faint">Tests existants</span>
            <span className="t-24 font-light text-money">{feature.testsExistantsCount}</span>
          </div>
          <div className="rounded-(--radius-md) bg-surface-1 border border-(--border-shell) p-(--space-4) flex flex-col gap-(--space-1)">
            <span className="t-11 font-medium text-text-faint">Tests manquants</span>
            <span className={`t-24 font-light ${gapCls}`}>{feature.testsManquantsCount}</span>
            <span className="t-10 text-text-ghost">gap : {feature.testGap}</span>
          </div>
        </div>
      )}

      {/* Spec complète */}
      <div className="space-y-(--space-3)">
        <div className="flex items-center gap-(--space-3)">
          <h2 className="t-15 font-light text-text">Spec complète</h2>
          <code className="t-11 font-mono px-(--space-2) py-(--space-1) bg-(--surface-2) rounded-(--radius-xs) text-text-muted">
            docs/features/{id}.md
          </code>
        </div>

        {specContent ? (
          <pre className="bg-surface-1 border border-(--border-shell) rounded-(--radius-md) p-(--space-6) t-12 font-mono text-text-soft overflow-auto max-h-[var(--max-height-page-content)] leading-(--leading-relaxed) whitespace-pre-wrap break-words">
            {specContent}
          </pre>
        ) : (
          <div className="rounded-(--radius-md) bg-(--warn)/10 border border-(--warn)/25 p-(--space-4) text-warn t-13">
            Fichier spec introuvable : <code className="font-mono t-11">docs/features/{id}.md</code>
          </div>
        )}
      </div>
    </div>
  );
}
