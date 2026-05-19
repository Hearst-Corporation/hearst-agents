"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Eyebrow, Title, Sub, KpiGrid, KpiCard, Card } from "@hearst/cockpit-shell";
import type { CockpitTodayPayload } from "@/lib/cockpit/today";

export const dynamic = "force-dynamic";

function formatAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  return `il y a ${days} j`;
}

function formatTime(input: string | number | Date | null | undefined): string {
  if (!input) return "—";
  try {
    const d = new Date(input);
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

export default function HomePage() {
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(" ")[0] ?? null;

  const [data, setData] = useState<CockpitTodayPayload | null>(null);
  const [refetchState, setRefetchState] = useState<"idle" | "loading" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/v2/cockpit/today", { credentials: "include" });
        if (cancelled) return;
        if (!res.ok) {
          setRefetchState("error");
          return;
        }
        const payload = (await res.json()) as CockpitTodayPayload;
        if (!cancelled) {
          setData(payload);
          setRefetchState("idle");
        }
      } catch {
        if (!cancelled) setRefetchState("error");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const runningCount = data ? data.missionsRunning.filter((m) => m.status === "running").length : 0;
  const recentCount = data ? data.missionsRunning.length : 0;
  const missionsValue = runningCount > 0 ? String(runningCount) : recentCount > 0 ? String(recentCount) : "0";

  const agendaCount = data ? data.agenda.length : 0;
  const inboxItems = data ? data.inbox.brief?.items.length ?? 0 : 0;
  const suggCount = data ? data.suggestions.length : 0;

  const factoryRows = data ? data.missionsRunning.slice(0, 5).map((m) => ({
    id: m.id,
    missionId: m.id,
    name: m.name,
    status: m.status,
    when: m.lastRunAt ? formatAgo(m.lastRunAt) : "—",
    detail: m.status === "failed" && m.lastError
      ? m.lastError.slice(0, 80) + (m.lastError.length > 80 ? "…" : "")
      : m.status === "running" && m.runningSince
        ? `démarrée ${formatAgo(m.runningSince)}`
        : null,
  })) : [];

  const inboxItemsList = data && data.inbox.brief
    ? data.inbox.brief.items.slice(0, 3).map((it) => ({ id: it.id, title: it.title, summary: it.summary }))
    : [];

  const agendaItemsList = data
    ? data.agenda.slice(0, 3).map((ev) => ({ id: ev.id, title: ev.title, when: formatTime(ev.startsAt) }))
    : [];

  const proposals = data ? data.suggestions.slice(0, 3).map((s) => ({
    id: s.id,
    title: s.title,
    description: s.description,
  })) : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, padding: "24px 32px", maxWidth: 1200 }}>
      <div>
        <Eyebrow>Hearst Helm</Eyebrow>
        <Title>{firstName ? `Bonjour, ${firstName}.` : "Bonjour."}</Title>
        <Sub>
          {runningCount > 0
            ? `${missionsValue} exécutions en cours.`
            : recentCount > 0
            ? `${recentCount} missions récentes.`
            : "Aucune décision urgente requise."}
        </Sub>
      </div>

      {refetchState === "error" && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 8,
            border: "1px solid var(--ct-border)",
            background: "var(--ct-surface-1)",
            fontSize: 12,
            color: "var(--ct-text-secondary)",
          }}
        >
          Impossible de rafraîchir les données. Affichage des dernières informations connues.
        </div>
      )}

      <KpiGrid>
        <KpiCard label="Missions" value={missionsValue} accent />
        <KpiCard label="Agenda" value={data ? String(agendaCount) : "—"} />
        <KpiCard label="Messages" value={data ? String(inboxItems) : "—"} />
        <KpiCard label="Propositions" value={data ? String(suggCount) : "—"} />
      </KpiGrid>

      <Card title="Exécution active">
        {factoryRows.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--ct-text-secondary)" }}>Aucune mission active.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {factoryRows.map((row) => (
              <div
                key={row.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  padding: "8px 0",
                  borderBottom: "1px solid var(--ct-border)",
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ct-text-primary)" }}>
                  {row.name}
                </span>
                {row.detail && (
                  <span style={{ fontSize: 11, color: "var(--ct-text-secondary)" }}>{row.detail}</span>
                )}
                <span style={{ fontSize: 10, fontFamily: "monospace", color: "var(--ct-text-faint)", marginTop: 2 }}>
                  {row.when}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card title="Radar">
          {inboxItemsList.length === 0 && agendaItemsList.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--ct-text-secondary)" }}>Rien à signaler.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {inboxItemsList.map((it) => (
                <div key={it.id} style={{ padding: "6px 0", borderBottom: "1px solid var(--ct-border)" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ct-text-primary)" }}>{it.title}</div>
                  <div style={{ fontSize: 11, color: "var(--ct-text-secondary)" }}>{it.summary}</div>
                </div>
              ))}
              {agendaItemsList.map((ev) => (
                <div key={ev.id} style={{ padding: "6px 0", borderBottom: "1px solid var(--ct-border)" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ct-text-primary)" }}>{ev.title}</div>
                  <div style={{ fontSize: 11, color: "var(--ct-text-secondary)" }}>{ev.when}</div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Initiatives">
          {proposals.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--ct-text-secondary)" }}>Aucune proposition.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {proposals.map((p) => (
                <div key={p.id} style={{ padding: "6px 0", borderBottom: "1px solid var(--ct-border)" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ct-text-primary)" }}>{p.title}</div>
                  <div style={{ fontSize: 11, color: "var(--ct-text-secondary)" }}>{p.description}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
