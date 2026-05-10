"use client";

/**
 * SignalBoardStage — Q3-B (Stage dédié pour les signaux ambient).
 *
 * Drill-down de l'Anomaly Whisper de la PulseBar : l'utilisateur voit ici
 * TOUS les signaux ambient agrégés cross-données (mission_failed,
 * oauth_expired, brief_stale, variant_timeout, mission_silent) sur une
 * fenêtre élargie (7j par défaut), avec filtres par kind, timeline
 * chronologique et bouton "Investiguer →" qui pousse une query préremplie
 * dans le Commandeur.
 *
 * Style "silent luxury" :
 *   - pas de rouge agressif (warning = teal sourd, pas crit)
 *   - espacement généreux (var(--space-8) entre cards)
 *   - animations lentes (var(--duration-slow))
 *   - typographie sobre (t-13 pour le corps, t-15 pour le titre)
 */

import { useEffect, useMemo, useState } from "react";
import { useStageStore } from "@/stores/stage";
import { StageActionBar } from "./StageActionBar";
import { EmptyState } from "../ui";

interface AmbientSignal {
  id: string;
  kind:
    | "mission_failed"
    | "oauth_expired"
    | "brief_stale"
    | "variant_timeout"
    | "mission_silent";
  narration: string;
  detectedAt: string;
  ctaHref?: string;
  severity: "info" | "warning";
}

type SignalsResponse = { signals: AmbientSignal[]; range?: string };

type RangeKey = "1h" | "7d" | "30d" | "all";
type KindFilter = "all" | AmbientSignal["kind"];

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

/** Formatte un timestamp en distance relative FR ("il y a 12 min", "il y a 3 j"). */
function formatRelative(iso: string, nowMs: number): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const diff = Math.max(0, nowMs - t);
  const min = Math.round(diff / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `il y a ${hr} h`;
  const day = Math.round(hr / 24);
  if (day < 30) return `il y a ${day} j`;
  const month = Math.round(day / 30);
  return `il y a ${month} mois`;
}

/** Construit la query préremplie pour le Commandeur selon le kind du signal. */
function buildInvestigateQuery(signal: AmbientSignal): string {
  // narration FR ≤ 140ch — on en extrait le sujet ("Mission XYZ", "Connexion HubSpot").
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

export function SignalBoardStage() {
  const back = useStageStore((s) => s.back);
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

  // Refresh du tick relatif chaque minute pour les "il y a X min" sans re-fetch.
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Fetch signals au mount + à chaque changement de range. Les setStates
  // initiaux (loading=true, error=null) sont dans l'IIFE asynchrone pour
  // éviter le warning react-hooks/set-state-in-effect (cascading render).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
      try {
        const r = await fetch(`/api/v2/cockpit/signals?range=${range}`, {
          cache: "no-store",
        });
        if (!r.ok) {
          if (!cancelled) {
            setError("Impossible de charger les signaux");
            setLoading(false);
          }
          return;
        }
        const data = (await r.json()) as SignalsResponse;
        if (!cancelled) {
          setSignals(Array.isArray(data.signals) ? data.signals : []);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError("Erreur réseau");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [range]);

  // Filtrage côté client par kind (le serveur retourne tout, le filtre est UI).
  const filtered = useMemo(() => {
    if (kindFilter === "all") return signals;
    return signals.filter((s) => s.kind === kindFilter);
  }, [signals, kindFilter]);

  // Stats cumulatives — pour la sidebar.
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

  const onInvestigate = (signal: AmbientSignal) => {
    setCommandeurOpen(true, { prefilledQuery: buildInvestigateQuery(signal) });
  };

  return (
    <div
      className="flex-1 flex flex-col min-h-0 relative"
      style={{ background: "var(--surface)" }}
    >
      <StageActionBar
        context={
          <>
            <span
              className="rounded-pill bg-(--accent-teal) halo-dot"
              style={{ width: "var(--space-2)", height: "var(--space-2)" }}
            />
            <span className="t-11 font-medium text-(--accent-teal)">
              SIGNAUX
            </span>
            <span
              className="rounded-pill bg-[var(--text-ghost)]"
              style={{ width: "var(--space-1)", height: "var(--space-1)" }}
            />
            <span className="t-11 font-light text-text-muted">
              {filtered.length} affiché{filtered.length > 1 ? "s" : ""}
              {kindFilter !== "all" || range !== "7d" ? "" : ""}
            </span>
          </>
        }
        onBack={back}
      />

      <div className="flex-1 min-h-0 flex">
        {/* Colonne principale : header + filtres + timeline */}
        <section
          className="flex-1 min-w-0 flex flex-col min-h-0 overflow-y-auto"
          style={{ padding: "var(--space-12) var(--space-12)" }}
        >
          <div
            className="max-w-3xl mx-auto w-full flex flex-col"
            style={{ gap: "var(--space-8)" }}
          >
            {/* Header */}
            <header className="flex flex-col" style={{ gap: "var(--space-3)" }}>
              <h1 className="t-28 font-light text-text">Signaux</h1>
              <p
                className="t-13 font-light text-text-muted"
                style={{ lineHeight: "var(--leading-base)" }}
              >
                Vue agrégée de l&apos;activité ambient — missions, connexions,
                briefings, vidéos. Choisis une fenêtre, filtre par type, ou
                investigue un signal en particulier.
              </p>
            </header>

            {/* Filtres : range + kind */}
            <div className="flex flex-col" style={{ gap: "var(--space-3)" }}>
              <div className="flex items-center" style={{ gap: "var(--space-2)" }}>
                <span className="t-11 font-light text-text-faint shrink-0">
                  Fenêtre
                </span>
                <div className="flex" style={{ gap: "var(--space-1)" }}>
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
                <span className="t-11 font-light text-text-faint shrink-0">
                  Type
                </span>
                <div className="flex flex-wrap" style={{ gap: "var(--space-1)" }}>
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

            {/* Timeline */}
            <div className="flex flex-col" style={{ gap: "var(--space-4)" }}>
              {loading && <SignalSkeleton count={3} />}
              {!loading && error && (
                <EmptyState
                  icon="◇"
                  title="Échec de chargement"
                  description={error}
                />
              )}
              {!loading && !error && filtered.length === 0 && (
                <EmptyState
                  icon="◉"
                  title="Aucun signal"
                  description={
                    kindFilter === "all"
                      ? "Aucun signal ambient sur cette fenêtre. Tout va bien."
                      : "Aucun signal de ce type sur cette fenêtre."
                  }
                />
              )}
              {!loading &&
                !error &&
                filtered.map((sig) => (
                  <SignalCard
                    key={sig.id}
                    signal={sig}
                    nowMs={nowMs}
                    highlighted={sig.id === selectedSignalId}
                    onInvestigate={() => onInvestigate(sig)}
                  />
                ))}
            </div>
          </div>
        </section>

        {/* Sidebar stats */}
        <aside
          className="hidden lg:flex flex-col shrink-0 border-l border-(--border-default)"
          style={{
            width: "var(--width-signal-sidebar)",
            padding: "var(--space-8) var(--space-6)",
            gap: "var(--space-6)",
          }}
        >
          <header className="flex flex-col" style={{ gap: "var(--space-2)" }}>
            <span className="t-11 font-light text-text-faint">
              CUMUL
            </span>
            <p className="t-28 font-light text-text">{stats.total}</p>
            <p className="t-11 font-light text-text-faint">
              signal{stats.total > 1 ? "aux" : ""} sur la fenêtre
            </p>
          </header>

          <div className="flex flex-col" style={{ gap: "var(--space-3)" }}>
            <span className="t-11 font-light text-text-faint">
              RÉPARTITION
            </span>
            {(Object.keys(stats.byKind) as Array<AmbientSignal["kind"]>).map(
              (kind) => (
                <div
                  key={kind}
                  className="flex items-center justify-between"
                  style={{ gap: "var(--space-3)" }}
                >
                  <span className="t-11 font-light text-text-muted truncate flex-1 min-w-0">
                    {KIND_LABEL[kind]}
                  </span>
                  <span className="t-11 font-mono tabular-nums text-text shrink-0">
                    {stats.byKind[kind]}
                  </span>
                </div>
              ),
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

// ── Components ──────────────────────────────────────────────────

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
      className="inline-flex items-center t-11 font-light shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-teal-border-hover)]"
      style={{
        paddingLeft: "var(--space-3)",
        paddingRight: "var(--space-3)",
        paddingTop: "var(--space-1)",
        paddingBottom: "var(--space-1)",
        background: active ? "var(--accent-teal-bg-active)" : "transparent",
        color: active ? "var(--accent-teal)" : "var(--text-muted)",
        border:
          "1px solid " +
          (active ? "var(--accent-teal-border-hover)" : "var(--border-shell)"),
        borderRadius: "var(--radius-xs)",
        cursor: "pointer",
        transition:
          "color var(--duration-base) var(--ease-standard), border-color var(--duration-base) var(--ease-standard), background var(--duration-base) var(--ease-standard)",
      }}
    >
      {label}
    </button>
  );
}

interface SignalCardProps {
  signal: AmbientSignal;
  nowMs: number;
  highlighted?: boolean;
  onInvestigate: () => void;
}

function SignalCard({ signal, nowMs, highlighted, onInvestigate }: SignalCardProps) {
  return (
    <article
      data-testid="signal-card"
      data-signal-kind={signal.kind}
      className="flex flex-col bg-bg-elev border-l-2"
      style={{
        gap: "var(--space-3)",
        padding: "var(--space-5) var(--space-6)",
        borderTopColor: "var(--surface-2)",
        borderRightColor: "var(--surface-2)",
        borderBottomColor: "var(--surface-2)",
        borderTopWidth: "1px",
        borderRightWidth: "1px",
        borderBottomWidth: "1px",
        borderLeftColor: highlighted
          ? "var(--accent-teal)"
          : "var(--accent-teal-bg-active)",
        borderRadius: "var(--radius-xs)",
        transition: "border-color var(--duration-slow) var(--ease-standard)",
      }}
    >
      <header
        className="flex items-start justify-between"
        style={{ gap: "var(--space-3)" }}
      >
        <div
          className="flex items-start min-w-0 flex-1"
          style={{ gap: "var(--space-3)" }}
        >
          <span
            aria-hidden
            className="t-15 text-(--accent-teal) opacity-70 shrink-0"
            style={{ lineHeight: 1 }}
          >
            {KIND_GLYPH[signal.kind]}
          </span>
          <div className="flex flex-col min-w-0 flex-1" style={{ gap: "var(--space-1)" }}>
            <p className="t-13 text-text" style={{ lineHeight: "var(--leading-base)" }}>
              {signal.narration}
            </p>
            <div
              className="flex items-center"
              style={{ gap: "var(--space-2)" }}
            >
              <span className="t-9 font-mono uppercase text-text-faint">
                {KIND_LABEL[signal.kind]}
              </span>
              <span
                className="rounded-pill bg-[var(--text-ghost)]"
                style={{ width: "var(--space-1)", height: "var(--space-1)" }}
                aria-hidden
              />
              <span className="t-11 font-light text-text-faint">
                {formatRelative(signal.detectedAt, nowMs)}
              </span>
            </div>
          </div>
        </div>
      </header>

      <footer
        className="flex items-center justify-end"
        style={{ gap: "var(--space-2)" }}
      >
        {signal.ctaHref && (
          <a
            href={signal.ctaHref}
            className="inline-flex items-center t-11 font-light text-text-muted hover:text-(--accent-teal) focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-teal-border-hover)]"
            style={{
              gap: "var(--space-1)",
              paddingLeft: "var(--space-2)",
              paddingRight: "var(--space-2)",
              paddingTop: "var(--space-1)",
              paddingBottom: "var(--space-1)",
              borderRadius: "var(--radius-xs)",
              transition: "color var(--duration-base) var(--ease-standard)",
            }}
          >
            <span>Voir</span>
            <span aria-hidden>→</span>
          </a>
        )}
        <button
          type="button"
          onClick={onInvestigate}
          className="inline-flex items-center t-11 font-light shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-teal-border-hover)]"
          style={{
            gap: "var(--space-1)",
            paddingLeft: "var(--space-3)",
            paddingRight: "var(--space-3)",
            paddingTop: "var(--space-1)",
            paddingBottom: "var(--space-1)",
            background: "transparent",
            color: "var(--text-faint)",
            border: "1px solid var(--border-shell)",
            borderRadius: "var(--radius-xs)",
            cursor: "pointer",
            transition:
              "color var(--duration-base) var(--ease-standard), border-color var(--duration-base) var(--ease-standard)",
          }}
        >
          <span>Investiguer</span>
          <span aria-hidden>→</span>
        </button>
      </footer>
    </article>
  );
}

function SignalSkeleton({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col bg-bg-elev border border-(--surface-2)"
          style={{
            gap: "var(--space-3)",
            padding: "var(--space-5) var(--space-6)",
            borderRadius: "var(--radius-xs)",
            opacity: 0.5,
          }}
        >
          <div
            className="rounded-pill bg-[var(--surface-2)]"
            style={{ height: "var(--space-3)", width: "60%" }}
          />
          <div
            className="rounded-pill bg-[var(--surface-2)]"
            style={{ height: "var(--space-2)", width: "30%" }}
          />
        </div>
      ))}
    </>
  );
}
