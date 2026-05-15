"use client";

/**
 * Page /admin/health — Tableau de santé consolidé.
 *
 * Sections :
 *   1. LLM — status / latence / breaker / cache hit / headroom par provider
 *      (anthropic, openai, gemini) depuis `/api/health/llm`.
 *   2. Workers BullMQ — placeholder (à venir, pas d'endpoint dédié pour
 *      l'instant côté workers).
 *   3. Supabase — ping `/api/health` (signal léger : si l'app répond, le
 *      serveur Next est up). Le check DB profond reste géré côté
 *      `lib/admin/health.ts` mais n'est pas exposé en client.
 *   4. Langfuse — enabled / flushable depuis le payload LLM.
 *
 * Auth : déléguée au layout `app/admin/layout.tsx` (session NextAuth ou
 * dev bypass). Pas de check supplémentaire ici.
 *
 * Refresh : automatique toutes les 30 secondes (cohérent avec
 * `/admin/metrics`). Bouton manuel pour forcer.
 */

import { useCallback, useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Types (miroir du payload de /api/health/llm)
// ---------------------------------------------------------------------------

type HealthStatus = "ok" | "degraded" | "down";
type CircuitState = "CLOSED" | "HALF_OPEN" | "OPEN";

interface ProviderHeadroom {
  requests_remaining: number | null;
  tokens_remaining: number | null;
  reset_at: string | null;
}

interface ProviderHealth {
  status: HealthStatus;
  latency_ms: number | null;
  breaker_state: CircuitState;
  cache_hit_ratio_24h: number | null;
  headroom: ProviderHeadroom;
}

interface LangfuseHealth {
  enabled: boolean;
  flushable: boolean;
}

interface LLMHealthResponse {
  ok: boolean;
  checked_at: string;
  providers: Record<string, ProviderHealth>;
  langfuse: LangfuseHealth;
}

interface BasicHealth {
  ok: boolean;
  service: string;
  time: string;
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const REFRESH_INTERVAL_MS = 30_000;
const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  gemini: "Gemini",
};

// ---------------------------------------------------------------------------
// Helpers de formatage
// ---------------------------------------------------------------------------

function fmtMs(ms: number | null): string {
  if (ms === null) return "—";
  return `${Math.round(ms)} ms`;
}

function fmtPct(rate: number | null): string {
  if (rate === null) return "—";
  return `${(rate * 100).toFixed(1)} %`;
}

function fmtNum(n: number | null): string {
  if (n === null) return "—";
  return n.toLocaleString("fr-FR");
}

function relativeReset(iso: string | null): string {
  if (!iso) return "—";
  const diff = Math.floor((new Date(iso).getTime() - Date.now()) / 1000);
  if (diff <= 0) return "imminent";
  if (diff < 60) return `dans ${diff}s`;
  if (diff < 3600) return `dans ${Math.floor(diff / 60)}min`;
  return `dans ${Math.floor(diff / 3600)}h`;
}

// ---------------------------------------------------------------------------
// Sous-composants (silent luxury : status pills, table, sections)
// ---------------------------------------------------------------------------

/**
 * Pill colorée — verte (ok), orange (degraded), rouge (down). Utilise les
 * tokens `--accent-teal`, `--warn`, `--danger` (pas de hex).
 */
function StatusPill({ status }: { status: HealthStatus }) {
  const cls =
    status === "ok"
      ? "bg-(--accent-teal)/15 text-(--accent-teal) border-(--accent-teal)/25"
      : status === "degraded"
        ? "bg-(--warn)/15 text-(--warn) border-(--warn)/25"
        : "bg-(--danger)/15 text-(--danger) border-(--danger)/25";

  const label = status === "ok" ? "Réussi" : status === "degraded" ? "Dégradé" : "Hors ligne";

  return (
    <span className={`t-10 px-(--space-2) py-(--space-1) rounded-pill border font-medium ${cls}`}>
      {label}
    </span>
  );
}

/**
 * Badge état du circuit breaker. CLOSED = nominal, HALF_OPEN = test reprise,
 * OPEN = bloqué.
 */
function CircuitBadge({ state }: { state: CircuitState }) {
  const cls =
    state === "CLOSED"
      ? "bg-(--accent-teal)/15 text-(--accent-teal)"
      : state === "OPEN"
        ? "bg-(--danger)/15 text-(--danger)"
        : "bg-(--warn)/15 text-(--warn)";

  const label = state === "CLOSED" ? "Fermé" : state === "HALF_OPEN" ? "Mi-ouvert" : "Ouvert";

  return (
    <span className={`t-10 px-(--space-2) py-(--space-1) rounded-pill font-medium ${cls}`}>
      {label}
    </span>
  );
}

/**
 * En-tête de section avec titre et description optionnelle. Voix régulière
 * FR, pas de mono caps post-pivot 2026-04-29.
 */
function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-(--space-4) flex items-baseline gap-(--space-3)">
      <h2 className="t-15 font-medium text-text">{title}</h2>
      {hint && <span className="t-10 text-text-ghost">{hint}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page principale
// ---------------------------------------------------------------------------

export default function HealthPage() {
  const [llmHealth, setLlmHealth] = useState<LLMHealthResponse | null>(null);
  const [supabaseHealth, setSupabaseHealth] = useState<BasicHealth | null>(null);
  const [supabaseLatency, setSupabaseLatency] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [llmRes, basicResStart] = await Promise.all([
        fetch("/api/health/llm"),
        (async () => {
          const t0 = Date.now();
          const res = await fetch("/api/health");
          return { res, latency: Date.now() - t0 };
        })(),
      ]);

      if (!llmRes.ok) throw new Error(`LLM health: ${llmRes.status}`);
      if (!basicResStart.res.ok) throw new Error(`Health: ${basicResStart.res.status}`);

      const llmData: LLMHealthResponse = await llmRes.json();
      const basicData: BasicHealth = await basicResStart.res.json();

      setLlmHealth(llmData);
      setSupabaseHealth(basicData);
      setSupabaseLatency(basicResStart.latency);
      setLastUpdated(new Date());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchAll();
    const id = setInterval(() => {
      void fetchAll();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchAll]);

  // ── Compteur "il y a Xs" ─────────────────────────────────────────────
  const [secondsSinceUpdate, setSecondsSinceUpdate] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setSecondsSinceUpdate(
        lastUpdated ? Math.floor((Date.now() - lastUpdated.getTime()) / 1000) : 0,
      );
    }, 1000);
    return () => clearInterval(id);
  }, [lastUpdated]);

  // ── État global agrégé ───────────────────────────────────────────────
  const overall: HealthStatus = (() => {
    if (!llmHealth) return "ok";
    if (!llmHealth.ok) return "down";
    const anyDegraded = Object.values(llmHealth.providers).some((p) => p.status === "degraded");
    return anyDegraded ? "degraded" : "ok";
  })();

  return (
    <div className="p-(--space-8) overflow-y-auto h-full" style={{ scrollbarWidth: "thin" }}>
      {/* En-tête */}
      <div className="flex items-center justify-between mb-(--space-8)">
        <div className="flex items-center gap-(--space-4)">
          <h1 className="t-24 font-light text-text">Santé système</h1>
          {!loading && llmHealth && <StatusPill status={overall} />}
        </div>
        <button
          onClick={fetchAll}
          className="t-13 text-text-faint hover:text-text transition-colors px-(--space-3) py-(--space-1) rounded-(--radius-sm) border border-(--border-shell) hover:border-(--border-soft)"
        >
          Rafraîchir
        </button>
      </div>

      {/* Erreur globale */}
      {error && (
        <div className="rounded-(--radius-md) bg-(--danger)/10 border border-(--danger)/25 p-(--space-4) text-danger t-13 mb-(--space-8)">
          {error}
        </div>
      )}

      {/* Loading initial */}
      {loading && (
        <div className="flex items-center justify-center py-(--space-16)">
          <span className="t-13 text-text-ghost">Chargement…</span>
        </div>
      )}

      {!loading && (
        <div className="space-y-(--space-8)">
          {/* ── Section 1 : LLM Providers ───────────────────────── */}
          <section>
            <SectionHeader
              title="LLM Providers"
              hint="latence p95 / état circuit breaker / headroom rate-limit"
            />
            {llmHealth ? (
              <div className="rounded-(--radius-md) bg-surface-1 border border-(--border-shell) overflow-hidden">
                {/* Header de tableau */}
                <div
                  className="grid px-(--space-4) py-(--space-2) t-10 text-text-ghost border-b border-(--border-shell)"
                  style={{
                    gridTemplateColumns: "1.2fr 0.8fr 0.8fr 0.8fr 0.8fr 1fr 1fr",
                  }}
                >
                  <span>Provider</span>
                  <span>Status</span>
                  <span>Latence p95</span>
                  <span>Breaker</span>
                  <span>Cache hit</span>
                  <span>Requêtes restantes</span>
                  <span>Reset</span>
                </div>

                {Object.entries(llmHealth.providers).map(([name, p]) => (
                  <div
                    key={name}
                    className="grid px-(--space-4) py-(--space-3) t-13 border-b border-line last:border-b-0 hover:bg-surface-2 transition-colors items-center"
                    style={{
                      gridTemplateColumns: "1.2fr 0.8fr 0.8fr 0.8fr 0.8fr 1fr 1fr",
                    }}
                  >
                    <span className="text-text font-medium">{PROVIDER_LABELS[name] ?? name}</span>
                    <span>
                      <StatusPill status={p.status} />
                    </span>
                    <span className="text-text-muted">{fmtMs(p.latency_ms)}</span>
                    <span>
                      <CircuitBadge state={p.breaker_state} />
                    </span>
                    <span className="text-text-muted">{fmtPct(p.cache_hit_ratio_24h)}</span>
                    <span className="text-text-muted">
                      {fmtNum(p.headroom.requests_remaining)}
                      {p.headroom.tokens_remaining !== null && (
                        <span className="text-text-ghost">
                          {" "}
                          / {fmtNum(p.headroom.tokens_remaining)} tok
                        </span>
                      )}
                    </span>
                    <span className="text-text-faint t-10">
                      {relativeReset(p.headroom.reset_at)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="t-13 text-text-ghost">Données indisponibles</p>
            )}
          </section>

          {/* ── Section 2 : Workers BullMQ ──────────────────────── */}
          <section>
            <SectionHeader
              title="Workers BullMQ"
              hint="file de jobs asynchrones (réservation à venir)"
            />
            <div className="rounded-(--radius-md) bg-surface-1 border border-(--border-shell) p-(--space-4) flex items-center justify-between">
              <div className="flex flex-col gap-(--space-1)">
                <span className="t-13 text-text-soft">État des workers</span>
                <span className="t-10 text-text-ghost">
                  Endpoint dédié non disponible pour l&apos;instant
                </span>
              </div>
              <span className="t-10 px-(--space-2) py-(--space-1) rounded-pill border border-(--border-shell) text-text-ghost">
                À venir
              </span>
            </div>
          </section>

          {/* ── Section 3 : Supabase ────────────────────────────── */}
          <section>
            <SectionHeader title="Supabase" hint="ping de l&apos;app Next.js (signal indirect)" />
            <div className="rounded-(--radius-md) bg-surface-1 border border-(--border-shell) p-(--space-4) flex items-center justify-between">
              <div className="flex flex-col gap-(--space-1)">
                <span className="t-13 text-text-soft">
                  {supabaseHealth?.service ?? "hearst-agents"}
                </span>
                <span className="t-10 text-text-ghost">
                  Latence ping : {fmtMs(supabaseLatency)}
                </span>
              </div>
              <StatusPill status={supabaseHealth?.ok ? "ok" : "down"} />
            </div>
          </section>

          {/* ── Section 4 : Langfuse ────────────────────────────── */}
          <section>
            <SectionHeader title="Langfuse" hint="observabilité prompts / outputs / traces" />
            <div className="rounded-(--radius-md) bg-surface-1 border border-(--border-shell) p-(--space-4) flex items-center justify-between">
              <div className="flex flex-col gap-(--space-1)">
                <span className="t-13 text-text-soft">
                  {llmHealth?.langfuse.enabled ? "Activé" : "Désactivé (clés absentes)"}
                </span>
                <span className="t-10 text-text-ghost">
                  Flushable : {llmHealth?.langfuse.flushable ? "oui" : "non"}
                </span>
              </div>
              <StatusPill
                status={
                  llmHealth?.langfuse.enabled && llmHealth.langfuse.flushable
                    ? "ok"
                    : llmHealth?.langfuse.enabled
                      ? "degraded"
                      : "down"
                }
              />
            </div>
          </section>
        </div>
      )}

      {/* Footer — fraîcheur */}
      {lastUpdated && (
        <p className="mt-(--space-8) t-10 text-text-ghost text-right">
          Mis à jour il y a {secondsSinceUpdate}s — refresh auto toutes les 30s
        </p>
      )}
    </div>
  );
}
