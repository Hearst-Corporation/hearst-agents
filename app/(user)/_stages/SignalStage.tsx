"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import type { AmbientSignal, AmbientSignalKind } from "@/lib/cockpit/ambient-signals";
import { useStageStore } from "@/stores/stage";
import { useStageData } from "@/stores/stage-data";
import type { RailItem } from "./types";

const VISION_EASE = [0.22, 1, 0.36, 1] as const;

const SECTION_VARIANTS = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: VISION_EASE } },
};

const LIST_VARIANTS = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.08 } },
};

const ITEM_VARIANTS = {
  hidden: { opacity: 0, x: -6 },
  show: { opacity: 1, x: 0, transition: { duration: 0.32, ease: VISION_EASE } },
};

type RangeKey = "1h" | "7d" | "30d" | "all";
type KindFilter = "all" | AmbientSignal["kind"];
type SignalsResponse = { signals: AmbientSignal[] };

const RANGE_OPTIONS: ReadonlyArray<{ key: RangeKey; label: string }> = [
  { key: "1h", label: "1 h" },
  { key: "7d", label: "7 j" },
  { key: "30d", label: "30 j" },
  { key: "all", label: "Tout" },
];

const KIND_OPTIONS: ReadonlyArray<{ key: KindFilter; label: string }> = [
  { key: "all", label: "Tous" },
  { key: "mission_failed", label: "Échec mission" },
  { key: "oauth_expired", label: "Connexion" },
  { key: "brief_stale", label: "Briefing" },
  { key: "variant_timeout", label: "Vidéo" },
  { key: "mission_silent", label: "Silencieuse" },
];

const KIND_GLYPH: Record<AmbientSignal["kind"], string> = {
  mission_failed: "◍",
  oauth_expired: "◇",
  brief_stale: "◐",
  variant_timeout: "◈",
  mission_silent: "◉",
};

const KIND_LABEL: Record<AmbientSignal["kind"], string> = {
  mission_failed: "Échec mission",
  oauth_expired: "Connexion expirée",
  brief_stale: "Briefing",
  variant_timeout: "Vidéo",
  mission_silent: "Mission silencieuse",
};

function kindLabel(kind: AmbientSignalKind): string {
  return KIND_LABEL[kind] ?? "Signal";
}

function formatRelative(iso: string, nowMs: number): string {
  const diff = Math.max(0, nowMs - Date.parse(iso));
  const min = Math.round(diff / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `il y a ${hr} h`;
  const day = Math.round(hr / 24);
  if (day < 30) return `il y a ${day} j`;
  return `il y a ${Math.round(day / 30)} mois`;
}

function buildInvestigateQuery(signal: AmbientSignal): string {
  const subject = signal.narration.split(" — ")[0] ?? signal.narration;
  switch (signal.kind) {
    case "mission_failed":
      return `Pourquoi la mission « ${subject.replace(/^Mission /, "")} » a échoué ?`;
    case "oauth_expired":
      return `Reconnecter ${subject.replace(/^Connexion /, "")}`;
    case "brief_stale":
      return "Régénérer le briefing du matin";
    case "variant_timeout":
      return `Pourquoi la vidéo « ${subject.replace(/^Vidéo /, "")} » a expiré ?`;
    case "mission_silent":
      return `Mission « ${subject.replace(/^Mission /, "")} » toujours pertinente ?`;
    default:
      return signal.narration;
  }
}

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="t-11 font-light shrink-0 inline-flex items-center focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-teal-border)]"
      style={{
        padding: "var(--space-1) var(--space-3)",
        background: active ? "var(--surface-2)" : "transparent",
        color: active ? "var(--text-muted)" : "var(--text-ghost)",
        border: `1px solid ${active ? "var(--border-input)" : "var(--border-shell)"}`,
        borderRadius: "var(--radius-pill)",
        cursor: "pointer",
        transition: "color 0.2s, border-color 0.2s, background 0.2s",
      }}
    >
      {label}
    </button>
  );
}

function SignalCard({
  signal,
  nowMs,
  highlighted,
  onInvestigate,
}: {
  signal: AmbientSignal;
  nowMs: number;
  highlighted?: boolean;
  onInvestigate: () => void;
}) {
  const isWarning = signal.severity === "warning";
  return (
    <motion.article
      variants={ITEM_VARIANTS}
      data-signal-kind={signal.kind}
      className="flex flex-col"
      style={{
        gap: "var(--space-3)",
        padding: "var(--space-5) var(--space-6)",
        background: isWarning ? "var(--surface-2)" : "var(--surface-1)",
        border: `1px solid ${highlighted ? "var(--border-input)" : "var(--border-shell)"}`,
        borderLeft: `2px solid ${highlighted ? "var(--text-muted)" : isWarning ? "var(--accent-agent)" : "var(--border-input)"}`,
        borderRadius: "var(--radius-md)",
        transition: "border-color var(--duration-base) var(--ease-standard)",
      }}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <span
            aria-hidden
            className="t-15 shrink-0 text-[var(--text-ghost)]"
            style={{ lineHeight: 1, marginTop: "2px" }}
          >
            {KIND_GLYPH[signal.kind]}
          </span>
          <div className="flex flex-col min-w-0 flex-1 gap-1">
            <p
              className="t-13 text-[var(--text-muted)]"
              style={{ lineHeight: "var(--leading-base)" }}
            >
              {signal.narration}
            </p>
            <div className="flex items-center gap-2">
              <span className="t-9 font-mono text-[var(--text-ghost)]">
                {KIND_LABEL[signal.kind]}
              </span>
              <span
                aria-hidden
                className="rounded-full bg-[var(--text-ghost)]"
                style={{ width: "var(--space-1)", height: "var(--space-1)" }}
              />
              <span className="t-11 font-light text-[var(--text-ghost)]">
                {formatRelative(signal.detectedAt, nowMs)}
              </span>
            </div>
          </div>
        </div>
      </header>

      <footer className="flex items-center justify-end gap-2">
        {signal.ctaHref && (
          <a
            href={signal.ctaHref}
            className="t-11 font-light text-[var(--text-ghost)] hover:text-[var(--text-faint)] transition-colors inline-flex items-center gap-1 focus-visible:outline-none"
            style={{ padding: "var(--space-1) var(--space-2)", borderRadius: "var(--radius-xs)" }}
          >
            Voir →
          </a>
        )}
        <button
          type="button"
          onClick={onInvestigate}
          className="t-11 font-light text-[var(--text-ghost)] hover:text-[var(--text-faint)] transition-colors inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--border-input)]"
          style={{
            padding: "var(--space-1) var(--space-3)",
            background: "transparent",
            border: "1px solid var(--border-shell)",
            borderRadius: "var(--radius-pill)",
            cursor: "pointer",
          }}
        >
          Investiguer →
        </button>
      </footer>
    </motion.article>
  );
}

function SignalSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="animate-pulse"
          style={{
            height: "72px",
            background: "var(--surface-1)",
            border: "1px solid var(--border-shell)",
            borderRadius: "var(--radius-md)",
          }}
        />
      ))}
    </div>
  );
}

export function SignalStage({ mode }: { mode: string }) {
  const setCommandeurOpen = useStageStore((s) => s.setCommandeurOpen);
  const stagePayload = useStageStore((s) => s.current);
  const selectedSignalId =
    stagePayload.mode === "signal" ? stagePayload.selectedSignalId : undefined;

  const [range, setRange] = useState<RangeKey>("7d");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [signals, setSignals] = useState<AmbientSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const r = await fetch(`/api/v2/cockpit/signals?range=${range}`, { cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = (await r.json()) as SignalsResponse;
        if (!cancelled) {
          setSignals(Array.isArray(data.signals) ? data.signals : []);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erreur réseau");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [range]);

  const filtered = useMemo(
    () => (kindFilter === "all" ? signals : signals.filter((s) => s.kind === kindFilter)),
    [signals, kindFilter],
  );

  const stats = useMemo(() => {
    const byKind: Record<AmbientSignal["kind"], number> = {
      mission_failed: 0,
      oauth_expired: 0,
      brief_stale: 0,
      variant_timeout: 0,
      mission_silent: 0,
    };
    for (const s of signals) byKind[s.kind] += 1;
    return { total: signals.length, byKind };
  }, [signals]);

  useEffect(() => {
    const warningCount = signals.filter((s) => s.severity === "warning").length;
    const items: RailItem[] = signals.slice(0, 4).map((s) => ({
      t: kindLabel(s.kind),
      s: s.severity === "warning" ? "Alerte" : "Info",
      hot: s.severity === "warning",
    }));
    const title =
      warningCount > 0
        ? `Connecteurs (${warningCount} alerte${warningCount > 1 ? "s" : ""})`
        : "Connecteurs";
    useStageData.getState().setShellData(title, items);
    return () => {
      useStageData.getState().clearShellData();
    };
  }, [signals]);

  const onInvestigate = (signal: AmbientSignal) => {
    setCommandeurOpen(true, { prefilledQuery: buildInvestigateQuery(signal) });
  };

  return (
    <motion.section
      key={mode}
      variants={SECTION_VARIANTS}
      initial="hidden"
      animate="show"
      className="preserve-3d flex w-full max-w-[760px] flex-col"
      style={{ gap: "var(--space-10)" }}
    >
      {/* Header */}
      <div className="flex flex-col" style={{ gap: "var(--space-2)" }}>
        <h2 className="t-28 font-light text-[var(--text)]">Signaux</h2>
        <p
          className="t-13 font-light text-[var(--text-ghost)]"
          style={{ lineHeight: "var(--leading-base)" }}
        >
          Activité ambient — missions, connexions, briefings, vidéos.
        </p>
      </div>

      {/* Filtres */}
      <div className="flex flex-col" style={{ gap: "var(--space-3)" }}>
        <div className="flex items-center flex-wrap" style={{ gap: "var(--space-2)" }}>
          <span
            className="t-11 font-light text-[var(--text-ghost)] shrink-0"
            style={{ width: "52px" }}
          >
            Fenêtre
          </span>
          <div className="flex flex-wrap" style={{ gap: "var(--space-1-5)" }}>
            {RANGE_OPTIONS.map((opt) => (
              <FilterPill
                key={opt.key}
                label={opt.label}
                active={range === opt.key}
                onClick={() => setRange(opt.key)}
              />
            ))}
          </div>
        </div>
        <div className="flex items-center flex-wrap" style={{ gap: "var(--space-2)" }}>
          <span
            className="t-11 font-light text-[var(--text-ghost)] shrink-0"
            style={{ width: "52px" }}
          >
            Type
          </span>
          <div className="flex flex-wrap" style={{ gap: "var(--space-1-5)" }}>
            {KIND_OPTIONS.map((opt) => (
              <FilterPill
                key={opt.key}
                label={opt.label}
                active={kindFilter === opt.key}
                onClick={() => setKindFilter(opt.key)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Corps + sidebar */}
      <div className="flex min-w-0" style={{ gap: "var(--space-8)" }}>
        {/* Timeline */}
        <div className="flex-1 min-w-0">
          {loading && <SignalSkeleton />}
          {!loading && error && (
            <div
              className="t-13 font-light text-[var(--danger)]"
              style={{
                padding: "var(--space-4) var(--space-5)",
                background: "color-mix(in srgb, var(--danger) 6%, transparent)",
                borderLeft: "2px solid color-mix(in srgb, var(--danger) 35%, transparent)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              Erreur — {error}
            </div>
          )}
          {!loading && !error && filtered.length === 0 && (
            <p className="t-13 font-light text-[var(--text-ghost)]">
              {kindFilter === "all"
                ? "Aucun signal sur cette fenêtre. L'agent veille."
                : "Aucun signal de ce type sur cette fenêtre."}
            </p>
          )}
          {!loading && !error && filtered.length > 0 && (
            <motion.div
              variants={LIST_VARIANTS}
              initial="hidden"
              animate="show"
              className="flex flex-col"
              style={{ gap: "var(--space-3)" }}
            >
              {filtered.map((sig) => (
                <SignalCard
                  key={sig.id}
                  signal={sig}
                  nowMs={nowMs}
                  highlighted={sig.id === selectedSignalId}
                  onInvestigate={() => onInvestigate(sig)}
                />
              ))}
            </motion.div>
          )}
        </div>

        {/* Sidebar stats */}
        <aside
          className="hidden lg:flex flex-col shrink-0"
          style={{ width: "136px", gap: "var(--space-6)", paddingTop: "var(--space-1)" }}
        >
          <div className="flex flex-col" style={{ gap: "var(--space-1)" }}>
            <span className="t-11 font-light text-[var(--text-ghost)]">Cumul</span>
            <p className="t-28 font-light text-[var(--text)]">{stats.total}</p>
            <p className="t-11 font-light text-[var(--text-ghost)]">
              signal{stats.total > 1 ? "aux" : ""} sur la fenêtre
            </p>
          </div>
          <div className="flex flex-col" style={{ gap: "var(--space-3)" }}>
            <span className="t-11 font-light text-[var(--text-ghost)]">Répartition</span>
            {(Object.keys(stats.byKind) as Array<AmbientSignal["kind"]>).map((kind) => (
              <div
                key={kind}
                className="flex items-center justify-between"
                style={{ gap: "var(--space-2)" }}
              >
                <span className="t-11 font-light text-[var(--text-ghost)] truncate flex-1 min-w-0">
                  {KIND_LABEL[kind]}
                </span>
                <span className="t-11 font-mono tabular-nums text-[var(--text-faint)] shrink-0">
                  {stats.byKind[kind]}
                </span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </motion.section>
  );
}
