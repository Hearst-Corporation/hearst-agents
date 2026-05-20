import Link from "next/link";
import { crewai } from "@/lib/crewai-client";
import { Card, HomShell, PageHeader } from "../_components/Shell";

export const metadata = { title: "Swarms — Helm" };
export const dynamic = "force-dynamic";

export default async function SwarmsPage() {
  let swarms: Array<{ id: string; name: string; description?: string }> = [];
  let listError: string | null = null;

  try {
    const data = await crewai.listSwarms();
    swarms = data.swarms ?? [];
  } catch (err) {
    listError = err instanceof Error ? err.message : "Failed to load swarms";
  }

  return (
    <HomShell current="/admin/orchestrator/swarms">
      <PageHeader title="Swarms" subtitle="Crews CrewAI dynamiques générés par l'Architect." />

      <div className="grid grid-cols-4 gap-(--space-4) mb-(--space-6)">
        <div className="rounded-(--radius-md) bg-surface-1 border border-(--line) p-(--space-4) flex flex-col gap-(--space-1)">
          <span className="t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
            Total swarms
          </span>
          <span className="t-24 font-light text-(--accent-teal)">{swarms.length}</span>
        </div>
      </div>

      <div className="flex items-center justify-between mb-(--space-4)">
        <span className="t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
          All swarms
        </span>
        <Link
          href="/admin/orchestrator/swarms/new"
          className="px-(--space-3) py-(--space-1) rounded-(--radius-pill) bg-(--accent-teal-bg-active) text-(--accent-teal) t-12 hover:opacity-80 transition-opacity"
        >
          + New swarm
        </Link>
      </div>

      <Card className="p-0 overflow-hidden">
        {listError ? (
          <div className="px-(--space-4) py-(--space-6) text-center">
            <p className="t-12 text-(--danger)">{listError}</p>
          </div>
        ) : swarms.length === 0 ? (
          <div className="px-(--space-4) py-(--space-6) text-center">
            <p className="t-13 text-text-muted">Aucun swarm encore.</p>
            <p className="t-11 text-text-faint mt-(--space-1)">
              Crée ton premier swarm avec l&apos;Architect.
            </p>
          </div>
        ) : (
          swarms.map((swarm) => (
            <Link
              key={swarm.id}
              href={`/admin/orchestrator/swarms/${swarm.id}`}
              className="flex items-center justify-between px-(--space-4) py-(--space-3) border-b border-(--line) last:border-0 hover:bg-surface-1 transition-colors"
            >
              <div className="flex flex-col gap-(--space-0)">
                <span className="t-13 text-text font-light">{swarm.name}</span>
                {swarm.description ? (
                  <span className="t-11 text-text-muted">{swarm.description}</span>
                ) : null}
              </div>
              <span className="t-11 text-(--accent-teal)">Lancer →</span>
            </Link>
          ))
        )}
      </Card>
    </HomShell>
  );
}
