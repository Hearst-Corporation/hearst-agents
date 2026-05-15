import Link from "next/link";
import { getServerSupabase } from "@/lib/platform/db/supabase";
import AgentCard from "../_components/AgentCard";
import EmptyState from "../_components/EmptyState";

export const dynamic = "force-dynamic";

interface AgentRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  model_provider: string;
  model_name: string;
  status: string;
}

export default async function AgentsPage() {
  let agents: AgentRow[] = [];
  let error: string | null = null;

  const sb = getServerSupabase();
  if (!sb) {
    error = "Supabase non configuré. Renseignez .env.local";
  } else {
    try {
      const res = await sb
        .from("agents")
        .select("id, name, slug, description, model_provider, model_name, status")
        .order("created_at", { ascending: false });
      if (res.error) throw new Error(res.error.message);
      agents = (res.data ?? []) as AgentRow[];
    } catch (e) {
      error = e instanceof Error ? e.message : "Erreur DB";
    }
  }

  return (
    <div className="px-(--space-8) py-(--space-10) h-full overflow-y-auto">
      <div className="mb-(--space-8) flex items-center justify-between">
        <h1 className="t-24 font-light text-text">Agents</h1>
        <Link
          href="/admin/agents/new"
          className="t-12 font-medium px-(--space-4) py-(--space-2) rounded-(--radius-sm) border border-(--accent-teal)/50 bg-(--accent-teal)/10 text-(--accent-teal) hover:bg-(--accent-teal)/15 transition-colors"
        >
          + Nouvel agent
        </Link>
      </div>

      {error && (
        <div className="mb-(--space-6) admin-callout-danger t-13 text-(--danger)">{error}</div>
      )}

      {agents.length === 0 && !error ? (
        <EmptyState
          title="Pas encore d'agent"
          description="Les agents définissent les comportements des assistants Hearst. Crée-en un manuellement, ou charge un set dev (4 agents typés : email, calendrier, research, slack)."
          createHref="/admin/agents/new"
          createLabel="+ Créer un agent"
          seedResource="agents"
        />
      ) : (
        <div className="grid grid-cols-1 gap-(--space-4) md:grid-cols-2 lg:grid-cols-3">
          {agents.map((a) => (
            <AgentCard key={a.id} agent={a} />
          ))}
        </div>
      )}
    </div>
  );
}
