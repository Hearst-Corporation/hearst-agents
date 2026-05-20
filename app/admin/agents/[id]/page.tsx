import Link from "next/link";
import { notFound } from "next/navigation";
import { Chip } from "@/app/(user)/components/ui/Chip";
import { BackLink } from "@/app/admin/_components/BackLink";
import { getServerSupabase } from "@/lib/platform/db/supabase";
import ChatWindow from "../../_components/ChatWindow";
import ModelBadge from "../../_components/ModelBadge";

export const dynamic = "force-dynamic";

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    active: "Actif",
    paused: "En pause",
    archived: "Archivé",
    running: "En cours",
    idle: "Inactif",
    error: "Erreur",
    completed: "Terminé",
    failed: "Échoué",
  };
  return map[status] ?? status;
}

interface Props {
  params: Promise<{ id: string }>;
}

interface RunRow {
  id: string;
  kind: string;
  status: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  latency_ms: number | null;
  created_at: string;
}

export default async function AgentDetailPage({ params }: Props) {
  const { id } = await params;
  const sb = getServerSupabase();

  if (!sb) notFound();

  const { data: agent, error } = await sb.from("agents").select("*").eq("id", id).single();

  if (error || !agent) notFound();

  const [skillsRes, memoriesRes, evalsRes, runsRes, convosRes] = await Promise.all([
    sb.from("agent_skills").select("skills(id, name, category)").eq("agent_id", id),
    sb
      .from("agent_memory")
      .select("id, key, value, memory_type, importance")
      .eq("agent_id", id)
      .order("importance", { ascending: false })
      .limit(10),
    sb
      .from("evaluations")
      .select("id, eval_type, score, passed, created_at")
      .eq("agent_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
    sb
      .from("runs")
      .select("id, kind, status, tokens_in, tokens_out, cost_usd, latency_ms, created_at")
      .eq("agent_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    sb.from("conversations").select("id", { count: "exact", head: true }).eq("agent_id", id),
  ]);

  const skills = skillsRes.data ?? [];
  const memories = memoriesRes.data ?? [];
  const evals = evalsRes.data ?? [];
  const runs = (runsRes.data ?? []) as unknown as RunRow[];
  const totalConversations = convosRes.count ?? 0;

  const totalTokens = runs.reduce((s, r) => s + r.tokens_in + r.tokens_out, 0);
  const totalCost = runs.reduce((s, r) => s + (r.cost_usd ?? 0), 0);
  const avgLatency =
    runs.filter((r) => r.latency_ms).length > 0
      ? Math.round(
          runs.filter((r) => r.latency_ms).reduce((s, r) => s + r.latency_ms!, 0) /
            runs.filter((r) => r.latency_ms).length,
        )
      : 0;
  const successRate =
    runs.length > 0
      ? Math.round((runs.filter((r) => r.status === "completed").length / runs.length) * 100)
      : 0;

  const statusDot: Record<string, string> = {
    active: "bg-(--money)",
    paused: "bg-(--warn)",
    archived: "bg-text-muted",
  };

  return (
    <div className="px-(--space-8) py-(--space-10) h-full overflow-y-auto">
      {/* Breadcrumb retour — pattern PageHeader.back */}
      <div className="mb-(--space-4)">
        <BackLink href="/admin/agents" label="Tous les agents" />
      </div>

      {/* Header */}
      <div className="mb-(--space-6) flex items-start justify-between">
        <div>
          <div className="mb-(--space-1) flex items-center gap-(--space-3)">
            <Chip
              variant="dot"
              className={statusDot[agent.status] ?? "bg-text-muted"}
              aria-hidden
            />
            <span className="sr-only">Statut : {statusLabel(agent.status)}</span>
            <h1 className="t-24 font-light text-text">{agent.name}</h1>
          </div>
          {agent.description && (
            <p className="mt-(--space-1) max-w-xl t-13 text-text-muted">{agent.description}</p>
          )}
          <div className="mt-(--space-2) flex items-center gap-(--space-3)">
            <ModelBadge provider={agent.model_provider} model={agent.model_name} />
            <span className="t-10 font-mono text-text-muted">v{agent.version}</span>
          </div>
        </div>
      </div>

      {/* Agent stats */}
      <div className="mb-(--space-8) grid grid-cols-2 gap-(--space-3) sm:grid-cols-5">
        {[
          { label: "Runs", value: runs.length },
          { label: "Conversations", value: totalConversations },
          {
            label: "Tokens",
            value: totalTokens > 1000 ? `${(totalTokens / 1000).toFixed(1)}k` : totalTokens,
          },
          { label: "Coût", value: `$${totalCost.toFixed(4)}` },
          { label: "Succès", value: `${successRate}%`, sub: `moy. ${avgLatency}ms` },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-(--radius-md) border border-(--border-shell) bg-(--bg-elev) px-(--space-4) py-(--space-3)"
          >
            <p className="t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
              {s.label}
            </p>
            <p className="mt-(--space-1) t-18 font-light text-text">{s.value}</p>
            {s.sub && <p className="t-10 text-text-ghost">{s.sub}</p>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-(--space-8) lg:grid-cols-2">
        {/* Left: Chat */}
        <div>
          <h2 className="mb-(--space-3) t-10 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
            Chat
          </h2>
          <ChatWindow agentId={id} />
        </div>

        {/* Right: Details */}
        <div className="space-y-(--space-5)">
          {/* System prompt */}
          <div className="rounded-(--radius-md) border border-(--border-shell) bg-(--bg-elev) p-(--space-5)">
            <h3 className="mb-(--space-2) t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
              System Prompt
            </h3>
            <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap font-mono t-9 leading-relaxed text-text-soft">
              {agent.system_prompt || "—"}
            </pre>
          </div>

          {/* Config */}
          <div className="rounded-(--radius-md) border border-(--border-shell) bg-(--bg-elev) p-(--space-5)">
            <h3 className="mb-(--space-2) t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
              Config
            </h3>
            <div className="grid grid-cols-3 gap-(--space-2) t-9">
              <div>
                <span className="text-text-muted">Température</span>
                <p className="text-text-soft">{agent.temperature}</p>
              </div>
              <div>
                <span className="text-text-muted">Max tokens</span>
                <p className="text-text-soft">{agent.max_tokens}</p>
              </div>
              <div>
                <span className="text-text-muted">Top P</span>
                <p className="text-text-soft">{agent.top_p}</p>
              </div>
            </div>
          </div>

          {/* Skills */}
          <div className="rounded-(--radius-md) border border-(--border-shell) bg-(--bg-elev) p-(--space-5)">
            <h3 className="mb-(--space-2) t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
              Skills
            </h3>
            {skills.length === 0 ? (
              <p className="t-9 text-text-ghost">Aucun skill attribué.</p>
            ) : (
              <div className="flex flex-wrap gap-(--space-2)">
                {skills.map((s) => {
                  const skill = s.skills as unknown as {
                    id: string;
                    name: string;
                    category: string;
                  } | null;
                  return skill ? (
                    <Chip key={skill.id} size="sm" variant="outlined" className="text-text-muted">
                      {skill.name}
                    </Chip>
                  ) : null;
                })}
              </div>
            )}
          </div>

          {/* Memory */}
          <div className="rounded-(--radius-md) border border-(--border-shell) bg-(--bg-elev) p-(--space-5)">
            <h3 className="mb-(--space-2) t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
              Mémoire
            </h3>
            {memories.length === 0 ? (
              <p className="t-9 text-text-ghost">Aucune mémoire.</p>
            ) : (
              <ul className="space-y-(--space-1) t-9 text-text-soft">
                {memories.map((m) => (
                  <li key={m.id} className="flex justify-between gap-(--space-2)">
                    <span className="truncate">
                      <span className="text-text-muted">{m.key}:</span> {m.value}
                    </span>
                    <span className="shrink-0 text-text-muted">
                      {(m.importance * 100).toFixed(0)}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Recent runs */}
          <div className="rounded-(--radius-md) border border-(--border-shell) bg-(--bg-elev) p-(--space-5)">
            <div className="mb-(--space-2) flex items-center justify-between">
              <h3 className="t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
                Runs récents
              </h3>
              <Link
                href={`/admin/runs?agent_id=${id}`}
                className="t-10 text-text-muted hover:text-text transition-colors"
              >
                Tout voir →
              </Link>
            </div>
            {runs.length === 0 ? (
              <p className="t-9 text-text-ghost">Aucun run.</p>
            ) : (
              <div className="space-y-(--space-1)">
                {runs.slice(0, 5).map((r) => (
                  <Link
                    key={r.id}
                    href={`/admin/runs/${r.id}`}
                    className="flex items-center justify-between rounded-(--radius-sm) px-(--space-2) py-(--space-1) t-9 transition-colors hover:bg-(--surface-1)"
                  >
                    <div className="flex items-center gap-(--space-2)">
                      <Chip
                        variant="dot"
                        className={
                          r.status === "completed"
                            ? "bg-(--money)"
                            : r.status === "failed"
                              ? "bg-(--danger)"
                              : "bg-text-muted"
                        }
                        aria-hidden
                      />
                      <span className="sr-only">Statut : {statusLabel(r.status)}</span>
                      <span className="text-text-muted">{r.kind}</span>
                    </div>
                    <span className="text-text-muted font-mono">
                      {new Date(r.created_at).toLocaleString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                        day: "2-digit",
                        month: "short",
                      })}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Evaluations */}
          <div className="rounded-(--radius-md) border border-(--border-shell) bg-(--bg-elev) p-(--space-5)">
            <h3 className="mb-(--space-2) t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
              Évaluations
            </h3>
            {evals.length === 0 ? (
              <p className="t-9 text-text-ghost">Aucune évaluation.</p>
            ) : (
              <ul className="space-y-(--space-1) t-9 text-text-soft">
                {evals.map((ev) => (
                  <li key={ev.id} className="flex justify-between gap-(--space-2)">
                    <span>
                      {ev.eval_type}{" "}
                      <span className={ev.passed ? "text-(--money)" : "text-(--danger)"}>
                        {ev.passed ? "Réussi" : "Échoué"}
                      </span>
                    </span>
                    <span className="text-text-muted">{(ev.score * 100).toFixed(0)}%</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
