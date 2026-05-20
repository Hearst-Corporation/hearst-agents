"use client";

/**
 * Page /admin/health — Tableau de santé consolidé.
 *
 * Sections :
 *   1. LLM Providers (agrégats in-process : breaker, latence p95, cache hit,
 *      headroom) — `/api/health/llm`.
 *   2. Database + Storage — Supabase DB & bucket.
 *   3. Jobs & Cache — Redis (Upstash REST + BullMQ TCP), Inngest.
 *   4. Search — Exa, Tavily, Perplexity.
 *   5. Media generation — fal, ElevenLabs, HeyGen, Runway, Deepgram, Recall.
 *   6. Doc / Code — LlamaParse, E2B, Browserbase.
 *   7. Lead — Apollo.
 *   8. Email — Resend.
 *   9. Observability — Langfuse (flushable depuis LLM endpoint) + Sentry,
 *      Axiom (ping).
 *  10. Security & Connectors — Arcjet, Composio.
 *
 * Les sections 2 → 10 sont alimentées par `/api/admin/health/services` qui
 * pingue chaque service tiers en parallèle (env var presence + ping léger
 * quand un endpoint gratuit existe).
 *
 * Auth : déléguée au layout `app/admin/layout.tsx`. Pas de check ici.
 *
 * Refresh : auto 30s + bouton manuel.
 *
 * Note Stream D : Hume et PDL ne sont pas listés tant que la décision de
 * suppression n'est pas tranchée (voir TODO dans `lib/admin/health.ts`).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Chip } from "@/app/(user)/components/ui/Chip";

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

// ── Services externes ───────────────────────────────────────────────────────

type ServiceStatus = "ok" | "degraded" | "down" | "not_configured";

type ServiceCategory =
  | "llm"
  | "database"
  | "storage"
  | "cache"
  | "jobs"
  | "search"
  | "media"
  | "doc"
  | "lead"
  | "email"
  | "observability"
  | "security"
  | "connectors";

interface ServiceCheck {
  name: string;
  category: ServiceCategory;
  status: ServiceStatus;
  latencyMs?: number;
  message?: string;
}

interface ServicesHealthReport {
  checkedAt: string;
  services: ServiceCheck[];
  summary: {
    ok: number;
    degraded: number;
    down: number;
    notConfigured: number;
    total: number;
  };
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

/**
 * Ordre + libellé d'affichage des catégories de services. L'ordre est
 * volontaire (impact business descendant). Toute catégorie absente du
 * payload est masquée automatiquement.
 */
const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  llm: "LLM (compléments)",
  database: "Base de données",
  storage: "Stockage",
  cache: "Cache",
  jobs: "Files & Jobs",
  search: "Recherche",
  media: "Génération média",
  doc: "Documents & Code",
  lead: "Lead",
  email: "Email",
  observability: "Observabilité",
  security: "Sécurité",
  connectors: "Connecteurs",
};

const CATEGORY_ORDER: ServiceCategory[] = [
  "database",
  "storage",
  "cache",
  "jobs",
  "search",
  "media",
  "doc",
  "lead",
  "email",
  "observability",
  "security",
  "connectors",
  // "llm" en dernier car les providers principaux sont déjà dans la section
  // dédiée tout en haut ; ici on n'affiche que les compléments (Gemini key,
  // DeepSeek…).
  "llm",
];

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
    <Chip size="sm" variant="outlined" className={cls}>
      {label}
    </Chip>
  );
}

/**
 * Variante 4 états pour les services externes : ajoute "Non configuré"
 * (gris neutre) pour distinguer "service éteint" de "service en panne".
 */
function ServiceStatusPill({ status }: { status: ServiceStatus }) {
  if (status === "not_configured") {
    return (
      <Chip size="sm" variant="outlined" className="text-text-ghost">
        Non configuré
      </Chip>
    );
  }
  // ServiceStatus restant ⊂ HealthStatus → on délègue.
  return <StatusPill status={status} />;
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
    <Chip size="sm" className={cls}>
      {label}
    </Chip>
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
  const [services, setServices] = useState<ServicesHealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [llmRes, basicResStart, servicesRes] = await Promise.all([
        fetch("/api/health/llm"),
        (async () => {
          const t0 = Date.now();
          const res = await fetch("/api/health");
          return { res, latency: Date.now() - t0 };
        })(),
        fetch("/api/admin/health/services"),
      ]);

      if (!llmRes.ok) throw new Error(`LLM health: ${llmRes.status}`);
      if (!basicResStart.res.ok) throw new Error(`Health: ${basicResStart.res.status}`);
      // /admin/health/services peut renvoyer 503 si tout est down ; on lit
      // quand même le payload pour rendre l'état complet.
      if (!servicesRes.ok && servicesRes.status !== 503) {
        throw new Error(`Services health: ${servicesRes.status}`);
      }

      const llmData: LLMHealthResponse = await llmRes.json();
      const basicData: BasicHealth = await basicResStart.res.json();
      const servicesData: ServicesHealthReport = await servicesRes.json();

      setLlmHealth(llmData);
      setSupabaseHealth(basicData);
      setSupabaseLatency(basicResStart.latency);
      setServices(servicesData);
      setLastUpdated(new Date());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Regroupe les services par catégorie, dans l'ordre de `CATEGORY_ORDER`.
   * Mémoïsé pour éviter de recomputer à chaque tick du compteur "il y a Xs".
   */
  const servicesByCategory = useMemo<Map<ServiceCategory, ServiceCheck[]>>(() => {
    const map = new Map<ServiceCategory, ServiceCheck[]>();
    if (!services) return map;
    for (const cat of CATEGORY_ORDER) map.set(cat, []);
    for (const s of services.services) {
      const bucket = map.get(s.category) ?? [];
      bucket.push(s);
      map.set(s.category, bucket);
    }
    return map;
  }, [services]);

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

          {/* ── Section 2 : Récap services externes ─────────────── */}
          {services && (
            <section>
              <SectionHeader
                title="Services externes"
                hint={`${services.summary.ok} OK · ${services.summary.degraded} dégradés · ${services.summary.down} hors ligne · ${services.summary.notConfigured} non configurés`}
              />

              <div className="space-y-(--space-6)">
                {CATEGORY_ORDER.map((cat) => {
                  const items = servicesByCategory.get(cat) ?? [];
                  if (items.length === 0) return null;
                  return (
                    <div key={cat}>
                      <h3 className="t-13 text-text-soft mb-(--space-3)">{CATEGORY_LABELS[cat]}</h3>
                      <div className="rounded-(--radius-md) bg-surface-1 border border-(--border-shell) overflow-hidden">
                        <div
                          className="grid px-(--space-4) py-(--space-2) t-10 text-text-ghost border-b border-(--border-shell)"
                          style={{ gridTemplateColumns: "1.4fr 0.8fr 0.8fr 2fr" }}
                        >
                          <span>Service</span>
                          <span>Statut</span>
                          <span>Latence</span>
                          <span>Note</span>
                        </div>
                        {items.map((svc) => (
                          <div
                            key={`${svc.category}-${svc.name}`}
                            className="grid px-(--space-4) py-(--space-3) t-13 border-b border-line last:border-b-0 hover:bg-surface-2 transition-colors items-center"
                            style={{ gridTemplateColumns: "1.4fr 0.8fr 0.8fr 2fr" }}
                          >
                            <span className="text-text font-medium">{svc.name}</span>
                            <span>
                              <ServiceStatusPill status={svc.status} />
                            </span>
                            <span className="text-text-muted">
                              {svc.latencyMs !== undefined ? fmtMs(svc.latencyMs) : "—"}
                            </span>
                            <span className="text-text-faint t-10">{svc.message ?? "—"}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── Section 3 : ping app Next.js (signal indirect) ──── */}
          <section>
            <SectionHeader title="Application Next.js" hint="ping `/api/health` (round-trip)" />
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

          {/* ── Section 4 : Langfuse (flushable, agrégat LLM) ───── */}
          <section>
            <SectionHeader
              title="Langfuse — flush"
              hint="observabilité prompts / outputs / traces"
            />
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
