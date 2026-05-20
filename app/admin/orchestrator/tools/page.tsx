import { CrewAIError, crewai } from "@/lib/crewai-client";
import { Card, HomShell, PageHeader } from "../_components/Shell";

export const dynamic = "force-dynamic";

interface CrewAITool {
  id?: string;
  name: string;
  description?: string;
  category?: string;
  is_active?: boolean;
}

async function loadTools(): Promise<{ tools: CrewAITool[]; engineError: string | null }> {
  try {
    const data = await crewai.listTools();
    return { tools: data.tools as CrewAITool[], engineError: null };
  } catch (err) {
    const crewErr = err as CrewAIError;
    if (crewErr.status === 404) {
      return { tools: [], engineError: null };
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return { tools: [], engineError: message };
  }
}

export default async function ToolsPage() {
  const { tools, engineError } = await loadTools();

  const grouped = tools.reduce<Record<string, CrewAITool[]>>((acc, tool) => {
    const cat = tool.category ?? "Other";
    (acc[cat] ??= []).push(tool);
    return acc;
  }, {});
  const categories = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));

  return (
    <HomShell current="/admin/orchestrator/tools">
      <PageHeader title="Tools" subtitle="Tools CrewAI disponibles pour les agents." />

      {engineError ? (
        <Card>
          <div className="flex items-center gap-(--space-2) mb-(--space-3)">
            <span className="inline-block w-2 h-2 rounded-full bg-(--danger)" />
            <h3 className="t-13 text-(--danger)">CrewAI engine injoignable</h3>
          </div>
          <p className="t-12 font-mono text-text-muted break-all mb-(--space-3)">{engineError}</p>
          <p className="t-11 text-text-ghost">
            Démarrer le microservice Python :{" "}
            <code className="font-mono bg-surface-2 px-(--space-1) rounded text-(--accent-teal)">
              cd services/crewai-engine &amp;&amp; uv run uvicorn src.main:app --reload --port 8000
            </code>
          </p>
        </Card>
      ) : tools.length === 0 ? (
        <Card>
          <h3 className="t-13 text-text mb-(--space-2)">Catalog vide</h3>
          <p className="t-12 text-text-muted">
            Le moteur CrewAI ne référence aucun tool. Provisionnez-en via migration Supabase ou
            l'API du moteur.
          </p>
        </Card>
      ) : (
        <>
          {/* Stats bar */}
          <div className="flex items-center gap-(--space-4) mb-(--space-6)">
            <span className="t-12 text-text-muted">
              <span className="t-15 font-light text-text mr-(--space-1)">{tools.length}</span>
              tool{tools.length > 1 ? "s" : ""}
            </span>
            <span className="t-12 text-text-muted">
              <span className="t-15 font-light text-text mr-(--space-1)">{categories.length}</span>
              catégorie{categories.length > 1 ? "s" : ""}
            </span>
            <span className="t-12 text-text-muted">
              <span className="t-15 font-light text-(--accent-teal) mr-(--space-1)">
                {tools.filter((t) => t.is_active !== false).length}
              </span>
              actif{tools.filter((t) => t.is_active !== false).length > 1 ? "s" : ""}
            </span>
          </div>

          {/* Category sections */}
          <div className="flex flex-col gap-(--space-8)">
            {categories.map(([cat, list]) => (
              <section key={cat}>
                <div className="flex items-center gap-(--space-3) mb-(--space-4)">
                  <span className="t-10 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
                    {cat}
                  </span>
                  <span className="t-10 font-mono text-text-ghost">· {list.length}</span>
                  <div className="flex-1 border-t border-(--line)" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-(--space-4)">
                  {list.map((tool, idx) => (
                    <Card key={tool.id ?? `${cat}-${idx}`}>
                      <div className="flex items-start justify-between gap-(--space-2) mb-(--space-2)">
                        <h3 className="t-13 text-text font-mono">{tool.name}</h3>
                        {tool.is_active === false ? (
                          <span className="shrink-0 inline-block px-(--space-2) py-(--space-0) rounded-(--radius-pill) t-9 font-mono uppercase tracking-(--tracking-stretch) bg-surface-1 text-text-ghost border border-(--line)">
                            inactif
                          </span>
                        ) : (
                          <span className="shrink-0 inline-block w-1.5 h-1.5 rounded-full bg-(--accent-teal) mt-1.5" />
                        )}
                      </div>
                      {tool.description ? (
                        <p className="t-12 text-text-muted leading-relaxed">{tool.description}</p>
                      ) : (
                        <p className="t-11 text-text-ghost italic">Pas de description.</p>
                      )}
                    </Card>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </HomShell>
  );
}
