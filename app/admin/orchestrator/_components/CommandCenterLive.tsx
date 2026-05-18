"use client";

import { useEffect, useState } from "react";
import type { CommandCenterState } from "@/lib/hom/types";
import { Card, StatusPill } from "./Shell";

export function CommandCenterLive({ initial }: { initial: CommandCenterState }) {
  const [state, setState] = useState<CommandCenterState>(initial);
  const [connected, setConnected] = useState<boolean>(false);

  useEffect(() => {
    let stopped = false;
    let pollTimer: number | undefined;
    let source: EventSource | null = null;

    const startPolling = () => {
      if (stopped) return;
      const tick = async () => {
        try {
          const res = await fetch("/api/orchestrator/cc/state", { cache: "no-store" });
          if (res.ok) setState(await res.json());
        } catch {
          /* ignore */
        }
      };
      tick();
      pollTimer = window.setInterval(tick, 5000) as unknown as number;
    };

    try {
      source = new EventSource("/api/orchestrator/cc/stream");
      source.addEventListener("state", (event) => {
        const payload = JSON.parse((event as MessageEvent).data) as CommandCenterState;
        setState(payload);
        setConnected(true);
      });
      source.addEventListener("session_expired", () => {
        source?.close();
        source = null;
        // Session expirée côté serveur — rechargement pour déclencher le flow
        // d'authentification NextAuth.
        window.location.reload();
      });
      source.onerror = () => {
        setConnected(false);
        source?.close();
        source = null;
        // Bascule sur polling si SSE rompu
        if (!pollTimer) startPolling();
      };
    } catch {
      startPolling();
    }

    return () => {
      stopped = true;
      source?.close();
      if (pollTimer) window.clearInterval(pollTimer);
    };
  }, []);

  return (
    <div className="space-y-(--space-5)">
      <div className="flex items-center gap-(--space-4) mb-(--space-2)">
        <span
          className={`inline-block size-(--space-2) rounded-(--radius-pill) ${
            connected ? "bg-(--accent-teal)" : "bg-(--warn)"
          }`}
        />
        <span className="t-11 font-mono text-text-muted">
          {connected ? "stream connecté" : "polling fallback"}
        </span>
        <span className="t-10 font-mono text-text-faint">
          heartbeat {new Date(state.master_heartbeat).toLocaleTimeString("fr-FR")}
        </span>
        <span className="t-10 font-mono text-text-faint ml-auto">
          phase: <span className="text-text">{state.phase}</span>
        </span>
        {state.run_id ? (
          <span className="t-10 font-mono text-text-faint">
            run: <span className="text-text">{state.run_id}</span>
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-(--space-4)">
        <Card>
          <h3 className="t-10 font-mono uppercase tracking-(--tracking-stretch) text-text-faint mb-(--space-3)">
            Agent grid
          </h3>
          <div className="space-y-(--space-2)">
            {state.agents.map((agent) => (
              <div
                key={agent.id}
                className="flex items-center justify-between px-(--space-3) py-(--space-2) rounded-(--radius-sm) bg-surface-1 border border-(--line)"
              >
                <div className="flex flex-col gap-(--space-0)">
                  <span className="t-12 text-text">{agent.id}</span>
                  <span className="t-10 font-mono text-text-faint">
                    {agent.current_task ?? "idle"}
                  </span>
                </div>
                <StatusPill status={agent.status} />
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="t-10 font-mono uppercase tracking-(--tracking-stretch) text-text-faint mb-(--space-3)">
            Severity stack
          </h3>
          <div className="space-y-(--space-2)">
            {(Object.entries(state.severity_stack) as [string, number][]).map(([k, v]) => {
              const tone =
                k === "critical" || k === "high"
                  ? "text-(--danger)"
                  : k === "medium"
                    ? "text-(--warn)"
                    : "text-text-muted";
              return (
                <div key={k} className="flex items-baseline justify-between">
                  <span className="t-12 text-text-muted capitalize">{k}</span>
                  <span className={`t-15 font-mono ${tone}`}>{v}</span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <h3 className="t-10 font-mono uppercase tracking-(--tracking-stretch) text-text-faint mb-(--space-3)">
            Trust delta
          </h3>
          {Object.keys(state.trust_delta).length === 0 ? (
            <p className="t-12 text-text-faint">Aucune variation depuis le dernier run.</p>
          ) : (
            <div className="space-y-(--space-1)">
              {Object.entries(state.trust_delta).map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between">
                  <span className="t-12 text-text-muted capitalize">{k.replace("_", " ")}</span>
                  <span
                    className={`t-13 font-mono ${
                      (v as number) > 0
                        ? "text-(--accent-teal)"
                        : (v as number) < 0
                          ? "text-(--danger)"
                          : "text-text-ghost"
                    }`}
                  >
                    {(v as number) > 0 ? "+" : ""}
                    {v as number}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-(--space-4)">
        <Card>
          <h3 className="t-10 font-mono uppercase tracking-(--tracking-stretch) text-text-faint mb-(--space-3)">
            Queue
          </h3>
          {state.queue.length === 0 ? (
            <p className="t-12 text-text-faint">Vide.</p>
          ) : (
            <ul className="space-y-(--space-1)">
              {state.queue.map((q) => (
                <li key={q.run_id} className="t-11 font-mono text-text-muted">
                  {q.run_id} · {q.status}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h3 className="t-10 font-mono uppercase tracking-(--tracking-stretch) text-text-faint mb-(--space-3)">
            Retries en cours
          </h3>
          {state.retries.length === 0 ? (
            <p className="t-12 text-text-faint">Aucun.</p>
          ) : (
            <ul className="space-y-(--space-1)">
              {state.retries.map((r, i) => (
                <li key={i} className="t-11 font-mono text-text-muted">
                  {r.agent} · attempt {r.attempt}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h3 className="t-10 font-mono uppercase tracking-(--tracking-stretch) text-text-faint mb-(--space-3)">
            Escalations
          </h3>
          {state.escalations.length === 0 ? (
            <p className="t-12 text-text-faint">Aucune.</p>
          ) : (
            <ul className="space-y-(--space-1)">
              {state.escalations.map((e) => (
                <li key={e.id} className="t-11 font-mono text-text-muted">
                  T{e.tier} · {e.reason}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {state.blockers.length > 0 ? (
        <Card>
          <h3 className="t-10 font-mono uppercase tracking-(--tracking-stretch) text-(--danger) mb-(--space-3)">
            Blockers
          </h3>
          <ul className="space-y-(--space-1)">
            {state.blockers.map((b, i) => (
              <li key={i} className="t-12 text-text">
                {b}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
