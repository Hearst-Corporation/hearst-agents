"use client";

/**
 * ArtifactStage — consumer data-bound de l'artifact actif.
 *
 * Lit `useStageStore` pour récupérer l'artifactId (mode "artifact"),
 * fetche le contenu + metadata via `/api/v2/assets/{id}` + `/variants`,
 * et pousse les rail items vers `useStageData.shellData` → ContextRail.
 *
 * Layout split : éditeur code read-only (gauche) + preview du runtime (droite).
 * Footer tabs : "Aperçu" / "Code" / "Versions".
 * États : loading, empty, error.
 */

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { sanitizeApiError } from "@/app/(user)/lib/sanitize-error";
import { useStageStore } from "@/stores/stage";
import { useStageData } from "@/stores/stage-data";
import type { RailItem } from "./types";

// ── Variants ──────────────────────────────────────────────────────────────────

const VISION_EASE = [0.22, 1, 0.36, 1] as const;

const CONTAINER_VARIANTS = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: VISION_EASE },
  },
};

const PANEL_VARIANTS = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: VISION_EASE } },
};

// ── Types ─────────────────────────────────────────────────────────────────────

type FetchState = "loading" | "ready" | "error" | "empty";
type FooterTab = "apercu" | "code" | "versions";

interface ArtifactMeta {
  title?: string | undefined;
  language?: string | undefined;
  model?: string | undefined;
  buildStatus?: string | undefined;
  createdAt?: string | undefined;
}

interface VersionRow {
  id: string;
  status: string;
  createdAt?: string | undefined;
}

// ── Mode démo (dev only) ─────────────────────────────────────────────────────
// Affiché uniquement en dev quand aucun artifact réel n'est branché, pour
// pouvoir développer le design sans backend. Inchangé en production.

const IS_DEV = process.env.NODE_ENV !== "production";

const DEMO_ARTIFACT_ID = "art_demo_7c2f9a1e";

const DEMO_CODE = `import csv
from datetime import datetime


def synthese_prospects(chemin_csv: str) -> dict:
    """Agrège les prospects par secteur et calcule le score moyen."""
    secteurs: dict[str, list[float]] = {}

    with open(chemin_csv, encoding="utf-8") as fichier:
        for ligne in csv.DictReader(fichier):
            secteur = ligne["secteur"].strip()
            score = float(ligne["score"])
            secteurs.setdefault(secteur, []).append(score)

    resultat = {
        secteur: round(sum(scores) / len(scores), 2)
        for secteur, scores in secteurs.items()
    }

    print(f"Synthèse générée le {datetime.now():%d/%m/%Y %H:%M}")
    return resultat


if __name__ == "__main__":
    print(synthese_prospects("prospects.csv"))
`;

const DEMO_META: ArtifactMeta = {
  title: "Synthèse prospects par secteur",
  language: "python",
  model: "claude-opus-4",
  buildStatus: "ready",
  createdAt: new Date().toISOString(),
};

const DEMO_VERSIONS: VersionRow[] = [
  { id: "ver_demo_b4d1f9c2", status: "ready", createdAt: new Date().toISOString() },
  {
    id: "ver_demo_a1c8e3d7",
    status: "ready",
    createdAt: new Date(Date.now() - 3_600_000).toISOString(),
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildStatusLabel(status: string | undefined): string {
  if (!status) return "—";
  if (status === "ready") return "Prêt";
  if (status === "running" || status === "pending") return "Build en cours";
  if (status === "failed" || status === "error") return "Erreur build";
  return status;
}

function buildStatusColor(status: string | undefined): string {
  if (!status) return "rgba(255,255,255,0.3)";
  if (status === "ready") return "rgba(160,255,160,0.65)";
  if (status === "running" || status === "pending") return "rgba(255,200,80,0.7)";
  if (status === "failed" || status === "error") return "rgba(255,120,120,0.65)";
  return "rgba(255,255,255,0.3)";
}

// ── Sub-composants ─────────────────────────────────────────────────────────────

function DemoBanner() {
  return (
    <div
      className="t-9 font-mono uppercase tracking-wide"
      style={{
        alignSelf: "flex-start",
        color: "var(--text-faint)",
        background: "var(--surface-1)",
        padding: "var(--space-1) var(--space-3)",
        borderRadius: "var(--radius-pill, 9999px)",
      }}
    >
      Démo · données fictives (dev)
    </div>
  );
}

function EmptyArtifactState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: VISION_EASE }}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "80px 0",
        textAlign: "center",
      }}
    >
      <p
        className="t-15"
        style={{
          color: "rgba(255,255,255,0.45)",
          maxWidth: "440px",
          lineHeight: 1.6,
        }}
      >
        Lance une mission qui génère un artifact ou demande à l'agent.
      </p>
    </motion.div>
  );
}

function LoadingState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: VISION_EASE }}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "80px 0",
        gap: "10px",
      }}
    >
      <span
        className="inline-block rounded-full animate-pulse"
        style={{ width: "6px", height: "6px", background: "rgba(94,229,195,0.6)" }}
      />
      <span className="t-15" style={{ color: "rgba(255,255,255,0.35)" }}>
        Chargement de l'artifact…
      </span>
    </motion.div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: VISION_EASE }}
      style={{
        padding: "14px 18px",
        borderRadius: "12px",
        background: "rgba(255,80,80,0.08)",
        borderLeft: "2px solid rgba(255,120,120,0.55)",
        color: "rgba(255,200,200,0.85)",
        fontSize: "13px",
        lineHeight: 1.55,
      }}
    >
      <strong style={{ color: "rgba(255,180,180,0.95)", fontWeight: 600 }}>Erreur</strong> —{" "}
      {message}
    </motion.div>
  );
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  return (
    <div style={{ padding: "14px 16px" }}>
      <pre
        className="code-block"
        style={{
          margin: 0,
          fontSize: "12px",
          lineHeight: 1.7,
          color: "rgba(255,255,255,0.65)",
          fontFamily: "var(--font-mono, 'SF Mono', monospace)",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
        aria-label={`Code ${language}`}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}

function PreviewPanel() {
  return (
    <div className="flex flex-1 items-center justify-center" style={{ padding: "var(--space-6)" }}>
      <div className="vision-glass flex max-w-[360px] flex-col items-center gap-4 rounded-xl p-8 text-center">
        <p className="text-base font-medium text-[var(--text-muted)]">Sandbox E2B</p>
        <p className="text-sm text-[var(--text-ghost)]">
          L&apos;exécution de code en sandbox n&apos;est pas encore disponible.
        </p>
      </div>
    </div>
  );
}

function VersionsList({ versions }: { versions: VersionRow[] }) {
  if (versions.length === 0) {
    return (
      <div className="flex-1" style={{ padding: "14px 16px" }}>
        <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.3)" }}>
          Aucune version disponible.
        </p>
      </div>
    );
  }
  return (
    <div style={{ padding: "14px 16px" }}>
      <div className="flex flex-col" style={{ gap: "8px" }}>
        {versions.map((v, i) => (
          <div
            key={v.id}
            style={{
              padding: "10px 14px",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "8px",
            }}
          >
            <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.55)", fontWeight: 500 }}>
              V{versions.length - i}
            </span>
            <span
              style={{
                fontSize: "11px",
                fontFamily: "var(--font-mono, monospace)",
                color: "rgba(255,255,255,0.3)",
              }}
            >
              {v.id.slice(0, 8)}
            </span>
            <span style={{ fontSize: "11px", color: buildStatusColor(v.status) }}>
              {buildStatusLabel(v.status)}
            </span>
            {v.createdAt && (
              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)" }}>
                {new Date(v.createdAt).toLocaleDateString("fr-FR")}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Composant principal ────────────────────────────────────────────────────────

export function ArtifactStage({ mode }: { mode: string }) {
  const stagePayload = useStageStore((s) => s.current);
  const realArtifactId =
    stagePayload.mode === "artifact" ? (stagePayload.artifactId ?? null) : null;

  // Mode démo : actif uniquement en dev ET sans artifact réel. Le fetch réel
  // reste prioritaire — dès qu'un vrai artifact arrive, la démo disparaît.
  const demoActive = IS_DEV && !realArtifactId;
  const artifactId = realArtifactId ?? (demoActive ? DEMO_ARTIFACT_ID : null);

  const [fetchState, setFetchState] = useState<FetchState>(
    demoActive ? "ready" : artifactId ? "loading" : "empty",
  );
  const [code, setCode] = useState<string>(demoActive ? DEMO_CODE : "");
  const [meta, setMeta] = useState<ArtifactMeta>(demoActive ? DEMO_META : {});
  const [versions, setVersions] = useState<VersionRow[]>(demoActive ? DEMO_VERSIONS : []);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FooterTab>("apercu");

  // Fetch artifact + versions quand artifactId change
  useEffect(() => {
    if (demoActive) {
      // Pas d'appel réseau : on injecte l'artifact démo tel quel.
      setCode(DEMO_CODE);
      setMeta(DEMO_META);
      setVersions(DEMO_VERSIONS);
      setErrorMsg(null);
      setFetchState("ready");
      return;
    }

    if (!artifactId) {
      setFetchState("empty");
      setCode("");
      setMeta({});
      setVersions([]);
      return;
    }

    let cancelled = false;
    setFetchState("loading");

    void (async () => {
      try {
        const [assetRes, variantsRes] = await Promise.all([
          fetch(`/api/v2/assets/${artifactId}`, { credentials: "include" }),
          fetch(`/api/v2/assets/${artifactId}/variants`, { credentials: "include" }),
        ]);

        // Handle distinct des deux requêtes : l'asset est obligatoire (sans
        // lui rien à afficher → error), les variants sont optionnelles
        // (degraded mode : on affiche l'asset seul + warn dev).
        if (!assetRes.ok) {
          console.error("[ArtifactStage] asset fetch failed:", assetRes.status);
          if (!cancelled) {
            setErrorMsg("Impossible de charger l'asset.");
            setFetchState("error");
          }
          return;
        }

        const assetData = (await assetRes.json()) as {
          asset?: {
            contentRef?: string;
            title?: string;
            provenance?: { language?: string; model?: string };
            status?: string;
            createdAt?: string;
          };
        };

        if (!cancelled && assetData.asset) {
          const a = assetData.asset;
          setCode(a.contentRef ?? "");
          setMeta({
            title: a.title,
            language: a.provenance?.language ?? "python",
            model: a.provenance?.model,
            buildStatus: a.status,
            createdAt: a.createdAt,
          });
        }

        if (variantsRes.ok) {
          const varData = (await variantsRes.json()) as {
            variants?: Array<{ id: string; status: string; createdAt?: string }>;
          };
          if (!cancelled && Array.isArray(varData.variants)) {
            setVersions(
              varData.variants.map((v) => ({
                id: v.id,
                status: v.status,
                createdAt: v.createdAt,
              })),
            );
          }
        } else {
          // Non-fatal : l'asset est rendu sans liste de versions.
          console.warn("[ArtifactStage] variants fetch failed (optional):", variantsRes.status);
          if (!cancelled) setVersions([]);
        }

        if (!cancelled) setFetchState("ready");
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(sanitizeApiError(err));
          setFetchState("error");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [artifactId, demoActive]);

  // Push railItems → ContextRail
  useEffect(() => {
    const items: RailItem[] = [
      {
        t: "Build",
        s: buildStatusLabel(meta.buildStatus),
        hot: meta.buildStatus === "running" || meta.buildStatus === "pending",
      },
      {
        t: "Modèle",
        s: meta.model ?? "—",
      },
      {
        t: "Langage",
        s: meta.language ?? "—",
      },
      ...(versions.length > 0 ? [{ t: "Versions", s: `${versions.length}` }] : []),
      ...(meta.createdAt
        ? [{ t: "Créé", s: new Date(meta.createdAt).toLocaleDateString("fr-FR") }]
        : []),
    ];

    useStageData.getState().setShellData("Artifact · E2B", items);
    return () => {
      useStageData.getState().clearShellData();
    };
  }, [meta, versions]);

  const tabs: { key: FooterTab; label: string }[] = useMemo(
    () => [
      { key: "apercu", label: "Aperçu" },
      { key: "code", label: "Code" },
      { key: "versions", label: `Versions${versions.length > 0 ? ` (${versions.length})` : ""}` },
    ],
    [versions.length],
  );

  const fileName = meta.language === "node" ? "script.js" : "script.py";

  return (
    <motion.section
      key={mode}
      variants={CONTAINER_VARIANTS}
      initial="hidden"
      animate="visible"
      className="preserve-3d flex w-full flex-col gap-8"
    >
      {demoActive && <DemoBanner />}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-2xl font-semibold text-white/90">{meta.title ?? "Artifact"}</h2>
          <p className="text-sm text-white/40">
            {meta.model ? `${meta.model} · ` : ""}E2B · preview live
          </p>
        </div>

        {/* Badge statut */}
        {meta.buildStatus && (
          <div className="flex items-center gap-2 shrink-0" style={{ paddingTop: "4px" }}>
            <span
              className="inline-block rounded-full shrink-0"
              style={{
                width: "6px",
                height: "6px",
                background: buildStatusColor(meta.buildStatus),
              }}
            />
            <span style={{ fontSize: "12px", color: buildStatusColor(meta.buildStatus) }}>
              {buildStatusLabel(meta.buildStatus)}
            </span>
          </div>
        )}
      </div>

      {/* Corps principal */}
      <AnimatePresence mode="wait">
        {fetchState === "loading" && (
          <motion.div
            key="loading"
            variants={PANEL_VARIANTS}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0 }}
          >
            <LoadingState />
          </motion.div>
        )}

        {fetchState === "error" && errorMsg && (
          <motion.div
            key="error"
            variants={PANEL_VARIANTS}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0 }}
          >
            <ErrorState message={errorMsg} />
          </motion.div>
        )}

        {fetchState === "empty" && (
          <motion.div
            key="empty"
            variants={PANEL_VARIANTS}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0 }}
          >
            <EmptyArtifactState />
          </motion.div>
        )}

        {fetchState === "ready" && (
          <motion.div
            key="ready"
            variants={PANEL_VARIANTS}
            initial="hidden"
            animate="visible"
            className="flex gap-4"
          >
            {/* Éditeur code read-only */}
            <div
              className="flex flex-col flex-1 min-w-0"
              style={{
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "14px",
                overflow: "hidden",
              }}
            >
              {/* Tab bar éditeur */}
              <div
                className="flex items-center gap-2"
                style={{
                  padding: "8px 14px",
                  borderBottom: "1px solid rgba(255,255,255,0.07)",
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <span className="text-xs font-medium text-white/60">{fileName}</span>
                {(meta.buildStatus === "running" || meta.buildStatus === "pending") && (
                  <span className="text-xs text-yellow-300/60 animate-pulse">build en cours</span>
                )}
              </div>

              {code ? (
                <CodeBlock code={code} language={meta.language ?? "python"} />
              ) : (
                <div
                  className="flex-1 flex items-center justify-center"
                  style={{ padding: "var(--space-6)" }}
                >
                  <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.25)" }}>
                    Aucun code disponible.
                  </p>
                </div>
              )}
            </div>

            {/* Preview / Versions selon tab */}
            <div
              className="flex flex-col flex-1 min-w-0"
              style={{
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "14px",
                overflow: "hidden",
              }}
            >
              {/* Footer tabs */}
              <div
                className="flex items-center gap-1"
                style={{
                  padding: "8px 14px",
                  borderBottom: "1px solid rgba(255,255,255,0.07)",
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className="text-xs font-medium transition-colors"
                    style={{
                      padding: "4px 10px",
                      borderRadius: "20px",
                      background: activeTab === tab.key ? "rgba(255,255,255,0.1)" : "transparent",
                      color:
                        activeTab === tab.key ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.35)",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Contenu du panneau droit */}
              <AnimatePresence mode="wait">
                {activeTab === "apercu" && (
                  <motion.div
                    key="apercu"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex-1 flex flex-col"
                  >
                    <PreviewPanel />
                  </motion.div>
                )}

                {activeTab === "code" && (
                  <motion.div
                    key="code"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col"
                  >
                    {code ? (
                      <CodeBlock code={code} language={meta.language ?? "python"} />
                    ) : (
                      <div
                        className="flex-1 flex items-center justify-center"
                        style={{ padding: "var(--space-6)" }}
                      >
                        <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.25)" }}>
                          Aucun code disponible.
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}

                {activeTab === "versions" && (
                  <motion.div
                    key="versions"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col"
                  >
                    <VersionsList versions={versions} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="inline-block rounded-full"
            style={{
              width: "6px",
              height: "6px",
              background: buildStatusColor(meta.buildStatus),
            }}
          />
          <span className="text-xs text-white/30">E2B sandbox · {meta.language ?? "python"}</span>
        </div>

        {artifactId && (
          <span className="text-xs text-white/20 font-mono">{artifactId.slice(0, 8)}</span>
        )}
      </div>
    </motion.section>
  );
}
