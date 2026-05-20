"use client";

/**
 * Admin — Switch Tenant (debug)
 *
 * Génère un JWT Cortex pour n'importe quel tenant connu.
 * Accessible uniquement aux utilisateurs ayant scope admin.
 * Usage : copier le JWT → coller dans DevTools :
 *   localStorage.setItem("cortex_token_override", "<JWT>")
 *   puis recharger la page Cortex.
 */

import { useState } from "react";

interface TenantProject {
  projet: string;
  count: number;
}

interface TenantsResponse {
  tenants?: string[];
  // fallback si l'endpoint retourne des projets groupés par tenant
  projects?: TenantProject[];
}

interface GenerateResponse {
  token?: string;
  error?: string;
}

export default function SwitchTenantPage() {
  const [tenants, setTenants] = useState<string[]>([]);
  const [selectedTenant, setSelectedTenant] = useState("");
  const [customTenant, setCustomTenant] = useState("");
  const [ttl, setTtl] = useState(900);
  const [generatedToken, setGeneratedToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function fetchTenants() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cortex/admin/tenants");
      if (!res.ok) {
        // Fallback : utilise /api/cortex/projects si /admin/tenants n'existe pas encore
        const fallback = await fetch("/api/cortex/projects");
        if (!fallback.ok) throw new Error(`HTTP ${fallback.status}`);
        const data: TenantsResponse = await fallback.json();
        // Extraire les tenants depuis les projets (heuristique V1)
        const list = data.tenants ?? ["adrien"];
        setTenants(list);
        if (list.length > 0) setSelectedTenant(list[0]);
        return;
      }
      const data: TenantsResponse = await res.json();
      const list = data.tenants ?? [];
      setTenants(list);
      if (list.length > 0) setSelectedTenant(list[0]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function generateToken() {
    const tenantId = customTenant.trim() || selectedTenant;
    if (!tenantId) {
      setError("Sélectionne ou saisis un tenant.");
      return;
    }
    setLoading(true);
    setError(null);
    setGeneratedToken("");
    try {
      const res = await fetch("/api/admin/cortex-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId, ttl_seconds: ttl }),
      });
      const data: GenerateResponse = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setGeneratedToken(data.token ?? "");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function copyToken() {
    if (!generatedToken) return;
    navigator.clipboard.writeText(generatedToken).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function copySnippet() {
    if (!generatedToken) return;
    const snippet = `localStorage.setItem("cortex_token_override", ${JSON.stringify(generatedToken)})`;
    navigator.clipboard.writeText(snippet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-bg text-text">
      <div className="p-(--space-8) space-y-(--space-8) max-w-2xl">
        <div>
          <h1 className="t-24 font-light text-text">Switch Tenant</h1>
          <p className="t-13 text-text-muted mt-(--space-2)">
            Génère un JWT Cortex pour un tenant donné. Réservé aux admins.
          </p>
        </div>

        {/* ── Charger les tenants connus ──────────────── */}
        <section className="space-y-(--space-4)">
          <h2 className="t-10 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
            Tenants connus
          </h2>
          <div className="flex items-center gap-(--space-3)">
            <button
              type="button"
              onClick={fetchTenants}
              disabled={loading}
              className="px-(--space-4) py-(--space-2) rounded-(--radius-sm) bg-surface-2 border border-(--border-shell) t-13 text-text-muted hover:text-text transition-colors disabled:opacity-50"
            >
              {loading ? "Chargement…" : "Charger"}
            </button>
            {tenants.length > 0 && (
              <select
                value={selectedTenant}
                onChange={(e) => setSelectedTenant(e.target.value)}
                className="px-(--space-3) py-(--space-2) rounded-(--radius-sm) bg-surface-1 border border-(--border-shell) t-13 text-text"
              >
                {tenants.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            )}
          </div>
        </section>

        {/* ── Tenant custom ───────────────────────────── */}
        <section className="space-y-(--space-3)">
          <h2 className="t-10 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
            Ou saisir manuellement
          </h2>
          <input
            type="text"
            placeholder="ex: test-acme"
            value={customTenant}
            onChange={(e) => setCustomTenant(e.target.value)}
            className="w-full px-(--space-3) py-(--space-2) rounded-(--radius-sm) bg-surface-1 border border-(--border-shell) t-13 text-text placeholder:text-text-ghost"
          />
        </section>

        {/* ── TTL ─────────────────────────────────────── */}
        <section className="space-y-(--space-3)">
          <h2 className="t-10 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
            TTL (secondes)
          </h2>
          <div className="flex items-center gap-(--space-3)">
            {[900, 3600, 86400].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setTtl(v)}
                className={`px-(--space-3) py-(--space-1) rounded-(--radius-sm) border t-12 transition-colors ${
                  ttl === v
                    ? "bg-(--accent-bordeaux)/20 border-(--accent-bordeaux) text-(--accent-bordeaux)"
                    : "bg-surface-1 border-(--border-shell) text-text-muted"
                }`}
              >
                {v === 900 ? "15 min" : v === 3600 ? "1 h" : "24 h"}
              </button>
            ))}
            <input
              type="number"
              min={60}
              max={86400}
              value={ttl}
              onChange={(e) => setTtl(Number(e.target.value))}
              className="w-24 px-(--space-3) py-(--space-1) rounded-(--radius-sm) bg-surface-1 border border-(--border-shell) t-12 text-text"
            />
          </div>
        </section>

        {/* ── Générer ─────────────────────────────────── */}
        <button
          type="button"
          onClick={generateToken}
          disabled={loading || (!customTenant.trim() && !selectedTenant)}
          className="px-(--space-5) py-(--space-3) rounded-(--radius-sm) bg-(--accent-bordeaux) text-white t-14 font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {loading ? "Génération…" : "Générer JWT"}
        </button>

        {/* ── Erreur ──────────────────────────────────── */}
        {error && (
          <p className="t-12 text-(--danger) font-mono bg-(--danger)/10 rounded-(--radius-sm) px-(--space-3) py-(--space-2)">
            {error}
          </p>
        )}

        {/* ── Résultat ────────────────────────────────── */}
        {generatedToken && (
          <section className="space-y-(--space-4)">
            <h2 className="t-10 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
              JWT généré
            </h2>
            <textarea
              readOnly
              value={generatedToken}
              rows={4}
              className="w-full px-(--space-3) py-(--space-2) rounded-(--radius-sm) bg-surface-1 border border-(--border-shell) t-11 font-mono text-text-muted resize-none"
            />
            <div className="flex gap-(--space-3)">
              <button
                type="button"
                onClick={copyToken}
                className="px-(--space-4) py-(--space-2) rounded-(--radius-sm) bg-surface-2 border border-(--border-shell) t-13 text-text-muted hover:text-text transition-colors"
              >
                {copied ? "Copié !" : "Copier JWT"}
              </button>
              <button
                type="button"
                onClick={copySnippet}
                className="px-(--space-4) py-(--space-2) rounded-(--radius-sm) bg-surface-2 border border-(--border-shell) t-13 text-text-muted hover:text-text transition-colors"
              >
                Copier snippet localStorage
              </button>
            </div>
            <div className="rounded-(--radius-sm) bg-surface-1 border border-(--border-shell) p-(--space-4) space-y-(--space-2)">
              <p className="t-10 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
                Injection DevTools
              </p>
              <pre className="t-11 font-mono text-text-muted whitespace-pre-wrap break-all">
                {`localStorage.setItem("cortex_token_override", ${JSON.stringify(generatedToken)})`}
              </pre>
              <p className="t-11 text-text-ghost">
                Colle ce snippet dans la console du navigateur sur la page Cortex, puis recharge.
              </p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
