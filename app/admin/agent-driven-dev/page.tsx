import fs from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { getAgentLockState } from "@/lib/agent-lock";
import AgentLockCard from "./_components/AgentLockCard";
import RefreshManifestButton from "./_components/RefreshManifestButton";

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

async function loadManifest(): Promise<{ manifest: Manifest | null; error: string | null }> {
  try {
    const p = path.join(process.cwd(), "docs", "features", "_manifest.json");
    const raw = await fs.readFile(p, "utf-8");
    return { manifest: JSON.parse(raw) as Manifest, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return { manifest: null, error: msg };
  }
}

const STATUT_STYLES: Record<string, string> = {
  verrouillé: "bg-(--money)/10 text-money border-(--money)/30",
  in_progress: "bg-(--warn)/10 text-warn border-(--warn)/30",
  review: "bg-(--surface-2) text-text-muted border-line",
  active: "bg-(--accent-teal-bg-active) text-(--accent-teal) border-(--accent-teal)/30",
  legacy: "bg-(--danger)/10 text-danger border-(--danger)/30",
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

function StatutBadge({ statut, raw }: { statut: string; raw: string }) {
  const cls = STATUT_STYLES[statut] ?? "bg-(--surface-2) text-text-muted border-line";
  return (
    <span
      className={`inline-flex items-center px-(--space-2) py-(--space-1) rounded-pill border t-9 font-mono uppercase tracking-(--tracking-stretch) ${cls}`}
      title={raw}
    >
      {statut}
    </span>
  );
}

function FeatureRow({ feature }: { feature: FeatureEntry }) {
  const niveauClass = feature.niveau
    ? NIVEAU_STYLES[feature.niveau] ?? "text-text-muted"
    : "text-text-ghost";
  const gapClass = TEST_GAP_STYLES[feature.testGap] ?? "text-text-faint";

  return (
    <details className="group bg-surface-1 border border-(--border-shell) rounded-(--radius-md) overflow-hidden">
      <summary className="cursor-pointer list-none px-(--space-4) py-(--space-3) hover:bg-(--surface-2) transition-colors">
        <div className="grid grid-cols-12 items-center gap-(--space-3) t-13">
          <div className="col-span-3 flex items-center gap-(--space-2) min-w-0">
            <span className="text-text-faint group-open:rotate-90 transition-transform shrink-0">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </span>
            <span className="font-mono text-text truncate">{feature.id}</span>
          </div>
          <div className="col-span-2">
            <StatutBadge statut={feature.statut} raw={feature.statutRaw} />
          </div>
          <div className="col-span-1 t-12 text-text-muted">
            {feature.version ? `v${feature.version}` : "—"}
          </div>
          <div className={`col-span-1 t-12 font-medium ${niveauClass}`}>
            {feature.niveau ?? "—"}
          </div>
          <div className="col-span-2 t-12 text-text-muted truncate">
            {feature.derniereRevue ?? "—"}
          </div>
          <div className="col-span-1 t-12 text-text-soft text-right">
            {feature.invariantsCount}
          </div>
          <div className={`col-span-2 t-12 text-right ${gapClass}`}>
            {feature.testsManquantsCount} manquant{feature.testsManquantsCount > 1 ? "s" : ""}
            <span className="t-9 text-text-ghost ml-(--space-2)">({feature.testGap})</span>
          </div>
        </div>
      </summary>

      <div className="border-t border-line px-(--space-4) py-(--space-4) bg-(--surface-2)/40 space-y-(--space-4)">
        <div className="flex items-center gap-(--space-3) text-text-muted t-12">
          <span className="text-text-ghost">Owner</span>
          <span>{feature.owner ?? "—"}</span>
          <span className="text-text-ghost">·</span>
          <span className="text-text-ghost">Tests existants</span>
          <span className="text-money">{feature.testsExistantsCount}</span>
          <span className="text-text-ghost">·</span>
          <span className="text-text-ghost">Code orphelin</span>
          <span className={feature.orphansCount > 0 ? "text-warn" : "text-text-ghost"}>
            {feature.orphansCount}
          </span>
        </div>

        <div>
          <p className="t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint mb-(--space-2)">
            Invariants verrouillés ({feature.invariantsCount})
          </p>
          {feature.invariantsTitles.length > 0 ? (
            <ol className="space-y-(--space-1) t-12 text-text-soft">
              {feature.invariantsTitles.map((title, i) => (
                <li key={`${feature.id}-inv-${i}`} className="flex gap-(--space-2)">
                  <span className="text-text-ghost shrink-0">{i + 1}.</span>
                  <span>{title}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="t-12 text-text-ghost italic">Aucun invariant déclaré.</p>
          )}
        </div>

        <div className="flex items-center gap-(--space-3) pt-(--space-2) border-t border-line">
          <span className="t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
            Spec
          </span>
          <code className="t-11 font-mono px-(--space-1) py-(--space-1) bg-(--surface-2) rounded-(--radius-xs) text-text-muted">
            {feature.href}
          </code>
          <Link
            href={`/admin/agent-driven-dev/${feature.id}`}
            className="t-11 text-text-muted hover:text-(--accent-teal) transition-colors ml-auto"
          >
            Ouvrir spec complète →
          </Link>
        </div>
      </div>
    </details>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "default" | "warn" | "danger" | "money";
}) {
  const toneCls: Record<string, string> = {
    default: "text-text",
    warn: "text-warn",
    danger: "text-danger",
    money: "text-money",
  };
  return (
    <div className="rounded-(--radius-md) bg-surface-1 border border-(--border-shell) p-(--space-4) flex flex-col gap-(--space-1)">
      <span className="t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
        {label}
      </span>
      <span className={`t-24 font-light ${toneCls[tone]}`}>{value}</span>
      {sub && <span className="t-10 text-text-ghost">{sub}</span>}
    </div>
  );
}

export default async function AgentDrivenDevPage() {
  const [{ manifest, error }, lockState] = await Promise.all([
    loadManifest(),
    getAgentLockState(),
  ]);

  return (
    <div className="p-(--space-8) space-y-(--space-8) text-text-soft h-full overflow-y-auto">
      <AgentLockCard initial={lockState} />

      <div className="flex items-start justify-between gap-(--space-6)">
        <div className="space-y-(--space-2)">
          <h1 className="t-24 font-light text-text">Agent Driven Dev</h1>
          <p className="t-13 text-text-muted max-w-2xl">
            Tableau de bord du verrouillage features. Source de vérité :{" "}
            <code className="t-11 font-mono px-(--space-1) py-(--space-1) bg-(--surface-2) rounded-(--radius-xs)">
              docs/AGENT-DRIVEN-DEV.md
            </code>
            . Le manifest est régénéré via{" "}
            <code className="t-11 font-mono px-(--space-1) py-(--space-1) bg-(--surface-2) rounded-(--radius-xs)">
              npm run features:manifest
            </code>
            .
          </p>
        </div>
        <RefreshManifestButton />
      </div>

      {error && (
        <div className="rounded-(--radius-md) bg-(--danger)/10 border border-(--danger)/25 p-(--space-4) text-danger t-13">
          Manifest introuvable : {error}. Lance{" "}
          <code className="font-mono t-11">npm run features:manifest</code>.
        </div>
      )}

      {manifest && (
        <>
          <div className="grid gap-(--space-4) md:grid-cols-2 lg:grid-cols-4">
            <Kpi
              label="Verrouillées"
              value={`${manifest.counts["verrouillé"] ?? 0} / ${manifest.total}`}
              sub="features avec spec figée"
              tone="money"
            />
            <Kpi
              label="In progress / review"
              value={(manifest.counts.in_progress ?? 0) + (manifest.counts.review ?? 0)}
              sub="non encore verrouillées"
              tone="warn"
            />
            <Kpi
              label="Invariants"
              value={manifest.totals.invariants}
              sub="règles à respecter"
            />
            <Kpi
              label="Tests manquants"
              value={manifest.totals.testsManquants}
              sub={`${manifest.totals.testsExistants} existants`}
              tone={manifest.totals.testsManquants > 20 ? "danger" : "warn"}
            />
          </div>

          <div className="space-y-(--space-2)">
            <div className="grid grid-cols-12 items-center gap-(--space-3) px-(--space-4) t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
              <div className="col-span-3">Feature</div>
              <div className="col-span-2">Statut</div>
              <div className="col-span-1">Version</div>
              <div className="col-span-1">Niveau</div>
              <div className="col-span-2">Dernière revue</div>
              <div className="col-span-1 text-right">Inv.</div>
              <div className="col-span-2 text-right">Tests gap</div>
            </div>

            <div className="space-y-(--space-2)">
              {manifest.features.map((f) => (
                <FeatureRow key={f.id} feature={f} />
              ))}
            </div>
          </div>

          <p className="t-10 text-text-ghost">
            Manifest généré le {new Date(manifest.generatedAt).toLocaleString("fr-FR")}.
          </p>
        </>
      )}
    </div>
  );
}
