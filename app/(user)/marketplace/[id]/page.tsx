"use client";

/**
 * /marketplace/[id] — détail d'un template + actions (cloner, noter, signaler).
 *
 * Preview minimal :
 *   - workflow → liste des nodes
 *   - report_spec → liste des blocks
 *   - persona → fiche
 *
 * Actions : cloner, noter (1-5 + commentaire), signaler (raison libre).
 */

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "../../components/PageHeader";
import { Action } from "../../components/ui";
import type {
  MarketplaceTemplate,
  MarketplaceRating,
  CreativePromptPayload,
} from "@/lib/marketplace/types";
import type { WorkflowGraph } from "@/lib/workflows/types";
import type { ReportSpec } from "@/lib/reports/spec/schema";

interface DetailResponse {
  template: MarketplaceTemplate;
  ratings: MarketplaceRating[];
}

interface PageProps {
  params: Promise<{ id: string }>;
}

const KIND_LABELS: Record<string, string> = {
  workflow: "Workflow",
  report_spec: "Rapport",
  persona: "Persona",
  creative_prompt: "Pack créatif",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export default function MarketplaceDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<DetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Rate form
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState("");

  // Report form
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/v2/marketplace/templates/${id}`, {
          credentials: "include",
        });
        if (cancelled) return;
        if (!res.ok) {
          setError(res.status === 404 ? "Template introuvable" : `HTTP ${res.status}`);
          return;
        }
        const body = (await res.json()) as DetailResponse;
        if (!cancelled) setData(body);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "fetch_failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleClone() {
    setBusy(true);
    setFlash(null);
    try {
      const res = await fetch(`/api/v2/marketplace/templates/${id}/clone`, {
        method: "POST",
        credentials: "include",
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        resourceId?: string;
        error?: string;
      };
      if (!res.ok || !body.ok) {
        setFlash(`Clone échoué : ${body.error ?? `HTTP ${res.status}`}`);
        return;
      }
      // Redirige vers la ressource créée selon le kind.
      if (data?.template.kind === "workflow") {
        router.push(`/missions`);
      } else if (data?.template.kind === "report_spec") {
        router.push(`/reports`);
      } else if (data?.template.kind === "persona") {
        router.push(`/personas`);
      }
      // creative_prompt : pas de redirect — l'action "Utiliser" est gérée
      // par useCreativePromptPack ci-dessous (clipboard ou hook launcher).
      setFlash("Template cloné dans ton espace.");
    } catch (e) {
      setFlash(e instanceof Error ? e.message : "clone_failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleRate() {
    if (rating < 1 || rating > 5) return;
    setBusy(true);
    setFlash(null);
    try {
      const res = await fetch(`/api/v2/marketplace/templates/${id}/rate`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rating, comment: comment.trim() || undefined }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setFlash(`Note échouée : ${body.error ?? res.status}`);
        return;
      }
      setFlash("Merci pour la note.");
      // Refresh
      const fresh = await fetch(`/api/v2/marketplace/templates/${id}`, {
        credentials: "include",
      });
      if (fresh.ok) {
        const body = (await fresh.json()) as DetailResponse;
        setData(body);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleUseCreativePack() {
    if (!data || data.template.kind !== "creative_prompt") return;
    const payload = data.template.payload as CreativePromptPayload;
    setBusy(true);
    setFlash(null);
    try {
      // Pas encore de hook VideoQuickLaunch — copie le prompt en clipboard
      // et invite l'user à le coller dans le launcher de son choix.
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(payload.prompt);
        setFlash(
          "Prompt copié dans le presse-papiers — colle-le dans VideoQuickLaunch ou AssetVariantTabs.",
        );
      } else {
        setFlash("Prompt prêt — copie manuelle requise (clipboard indisponible).");
      }
    } catch (e) {
      setFlash(e instanceof Error ? e.message : "copy_failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleReport() {
    if (reportReason.trim().length < 3) return;
    setBusy(true);
    setFlash(null);
    try {
      const res = await fetch(`/api/v2/marketplace/templates/${id}/report`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: reportReason.trim() }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setFlash(`Signalement échoué : ${body.error ?? res.status}`);
        return;
      }
      setFlash("Signalement envoyé.");
      setReportOpen(false);
      setReportReason("");
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <div className="h-full min-h-0 overflow-y-auto bg-bg-elev text-text">
        <PageHeader
          title="Marketplace"
          back={{ label: "Retour", href: "/marketplace" }}
        />
        <p className="px-12 py-8 t-13 text-(--danger)">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-full min-h-0 overflow-y-auto bg-bg-elev text-text">
        <PageHeader
          title="Marketplace"
          back={{ label: "Retour", href: "/marketplace" }}
        />
        <p className="px-12 py-8 t-11 font-light text-text-faint">
          Chargement…
        </p>
      </div>
    );
  }

  const tpl = data.template;
  const author = tpl.authorDisplayName?.trim() || "Anonyme";

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-bg-elev text-text">
      <PageHeader
        title={tpl.title}
        subtitle={tpl.description ?? undefined}
        back={{ label: "Marketplace", href: "/marketplace" }}
        actions={
          <div className="flex gap-2">
            {tpl.kind === "creative_prompt" && (
              <Action
                variant="primary"
                tone="brand"
                size="sm"
                onClick={() => void handleUseCreativePack()}
                loading={busy}
                testId="detail-use-creative"
              >
                Utiliser dans VideoQuickLaunch
              </Action>
            )}
            {tpl.kind !== "creative_prompt" && (
              <Action
                variant="primary"
                tone="brand"
                size="sm"
                onClick={() => void handleClone()}
                loading={busy}
                testId="detail-clone"
              >
                Cloner
              </Action>
            )}
            <button
              type="button"
              onClick={() => setReportOpen((v) => !v)}
              disabled={busy}
              className="t-11 font-light text-text-faint hover:text-(--danger)"
              style={{ background: "transparent", border: "none", cursor: "pointer" }}
            >
              Signaler
            </button>
          </div>
        }
      />

      <div
        className="px-12 py-8 mx-auto w-full max-w-[min(100%,var(--width-actions))] flex flex-col gap-6"
      >
        {flash && (
          <p
            className="t-11 font-light text-(--accent-teal)"
          >
            {flash}
          </p>
        )}

        {/* Méta */}
        <section
          className="flex flex-wrap gap-3"
        >
          <Chip>{KIND_LABELS[tpl.kind] ?? tpl.kind}</Chip>
          <Chip>par {escapeHtml(author)}</Chip>
          {tpl.tags.map((tag) => (
            <Chip key={tag}>{escapeHtml(tag)}</Chip>
          ))}
          <Chip>
            {tpl.cloneCount} clone{tpl.cloneCount === 1 ? "" : "s"}
          </Chip>
          {tpl.ratingCount > 0 && (
            <Chip>
              ★ {tpl.ratingAvg.toFixed(1)} ({tpl.ratingCount})
            </Chip>
          )}
        </section>

        {/* Preview */}
        <section className="flex flex-col gap-3">
          <h2 className="t-13 text-text-soft">Aperçu</h2>
          {tpl.kind === "workflow" && (
            <WorkflowPreview graph={tpl.payload as WorkflowGraph} />
          )}
          {tpl.kind === "report_spec" && (
            <ReportPreview spec={tpl.payload as ReportSpec} />
          )}
          {tpl.kind === "persona" && (
            <PersonaPreview payload={tpl.payload as Record<string, unknown>} />
          )}
          {tpl.kind === "creative_prompt" && (
            <CreativePromptPreview payload={tpl.payload as CreativePromptPayload} />
          )}
        </section>

        {/* Report form */}
        {reportOpen && (
          <section
            className="flex flex-col gap-3 p-4 bg-bg-elev"
            style={{
              border: "1px solid var(--line-strong)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <h3 className="t-13 text-text">Signaler ce template</h3>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              rows={3}
              placeholder="Raison (3-500 caractères)…"
              maxLength={500}
              className="block w-full bg-transparent t-13 text-text focus:outline-none resize-none"
              style={{
                padding: "var(--space-2) var(--space-3)",
                border: "1px solid var(--line-strong)",
                borderRadius: "var(--radius-sm)",
                background: "var(--surface-1)",
              }}
            />
            <div
              className="flex items-center justify-end gap-3"
            >
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                className="t-11 font-light text-text-faint"
                style={{ background: "transparent", border: "none", cursor: "pointer" }}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void handleReport()}
                disabled={busy || reportReason.trim().length < 3}
                className="t-11 font-medium text-text"
                style={{
                  padding: "var(--space-2) var(--space-4)",
                  background: "var(--danger)",
                  border: "1px solid var(--danger)",
                  borderRadius: "var(--radius-sm)",
                  cursor: busy ? "not-allowed" : "pointer",
                  opacity: busy ? 0.6 : 1,
                }}
              >
                Envoyer
              </button>
            </div>
          </section>
        )}

        {/* Notation */}
        <section
          className="flex flex-col gap-3 p-4 bg-bg-elev"
          style={{
            border: "1px solid var(--line-strong)",
            borderRadius: "var(--radius-md)",
          }}
        >
          <h3 className="t-13 text-text">Donner une note</h3>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
                data-testid={`rate-${n}`}
                className="t-15"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: n <= rating ? "var(--accent-teal)" : "var(--text-ghost)",
                }}
              >
                ★
              </button>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            placeholder="Commentaire (optionnel)…"
            maxLength={500}
            className="block w-full bg-transparent t-13 text-text focus:outline-none resize-none"
            style={{
              padding: "var(--space-2) var(--space-3)",
              border: "1px solid var(--line-strong)",
              borderRadius: "var(--radius-sm)",
              background: "var(--surface-1)",
            }}
          />
          <div className="flex justify-end">
            <Action
              variant="primary"
              tone="brand"
              size="sm"
              onClick={() => void handleRate()}
              disabled={rating === 0}
              loading={busy}
              testId="rate-submit"
            >
              Envoyer la note
            </Action>
          </div>
        </section>

        {/* Ratings list */}
        {data.ratings.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="t-13 text-text-soft">
              Notes ({data.ratings.length})
            </h2>
            <ul className="flex flex-col gap-2">
              {data.ratings.map((r) => (
                <li
                  key={`${r.templateId}-${r.userId}`}
                  className="flex flex-col gap-1 p-3 bg-bg-elev"
                  style={{
                    border: "1px solid var(--line-strong)",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  <span className="t-11 font-medium text-(--accent-teal)">
                    {"★".repeat(r.rating)}
                    {"·".repeat(5 - r.rating)}
                  </span>
                  {r.comment && (
                    <p className="t-11 text-text-soft">
                      {escapeHtml(r.comment)}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="t-11 font-light text-text-faint"
      style={{
        padding: "var(--space-1) var(--space-2)",
        border: "1px solid var(--line-strong)",
        borderRadius: "var(--radius-pill)",
      }}
    >
      {children}
    </span>
  );
}

function WorkflowPreview({ graph }: { graph: WorkflowGraph }) {
  return (
    <ol
      className="flex flex-col gap-2 p-4 bg-bg-elev"
      style={{
        border: "1px solid var(--line-strong)",
        borderRadius: "var(--radius-md)",
      }}
    >
      {graph.nodes.map((n, i) => (
        <li
          key={n.id}
          className="flex items-baseline gap-2"
        >
          <span className="t-9 font-mono text-text-faint">
            {String(i + 1).padStart(2, "0")}
          </span>
          <span className="t-11 font-medium text-(--accent-teal)">
            {n.kind}
          </span>
          <span className="t-11 text-text">{escapeHtml(n.label)}</span>
        </li>
      ))}
    </ol>
  );
}

function ReportPreview({ spec }: { spec: ReportSpec }) {
  return (
    <div
      className="flex flex-col gap-2 p-4 bg-bg-elev"
      style={{
        border: "1px solid var(--line-strong)",
        borderRadius: "var(--radius-md)",
      }}
    >
      <p className="t-11 text-text-muted">
        {spec.sources.length} source{spec.sources.length === 1 ? "" : "s"} ·{" "}
        {spec.transforms.length} transform{spec.transforms.length === 1 ? "" : "s"} ·{" "}
        {spec.blocks.length} block{spec.blocks.length === 1 ? "" : "s"}
      </p>
      <ul className="flex flex-col gap-1">
        {spec.blocks.map((b) => (
          <li
            key={b.id}
            className="flex items-baseline gap-2"
          >
            <span className="t-11 font-medium text-(--accent-teal)">
              {b.type}
            </span>
            <span className="t-11 text-text">
              {escapeHtml(b.label ?? b.id)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CreativePromptPreview({ payload }: { payload: CreativePromptPayload }) {
  const params = payload.params ?? {};
  const ratio = params.ratio;
  const duration = params.duration;
  const tone = params.tone;
  return (
    <div
      className="flex flex-col gap-3 p-4 bg-bg-elev"
      style={{
        border: "1px solid var(--line-strong)",
        borderRadius: "var(--radius-md)",
      }}
    >
      <div className="flex flex-wrap" style={{ gap: "var(--space-2)" }}>
        <Chip>{payload.provider}</Chip>
        <Chip>{payload.kind}</Chip>
        {duration && <Chip>{duration}s</Chip>}
        {ratio && <Chip>{ratio}</Chip>}
        {tone && <Chip>{escapeHtml(tone)}</Chip>}
      </div>
      <div>
        <p className="t-11 text-text-soft mb-1">Prompt</p>
        <p
          className="t-13 text-text whitespace-pre-wrap"
          style={{ lineHeight: "var(--leading-normal)" }}
        >
          {escapeHtml(payload.prompt)}
        </p>
      </div>
    </div>
  );
}

function PersonaPreview({ payload }: { payload: Record<string, unknown> }) {
  const tone = typeof payload.tone === "string" ? payload.tone : null;
  const styleGuide = typeof payload.styleGuide === "string" ? payload.styleGuide : null;
  const systemPromptAddon =
    typeof payload.systemPromptAddon === "string" ? payload.systemPromptAddon : null;
  return (
    <div
      className="flex flex-col gap-2 p-4 bg-bg-elev"
      style={{
        border: "1px solid var(--line-strong)",
        borderRadius: "var(--radius-md)",
      }}
    >
      {tone && (
        <p className="t-11 text-text-soft">
          Ton : <strong>{escapeHtml(tone)}</strong>
        </p>
      )}
      {styleGuide && (
        <p className="t-11 text-text-soft whitespace-pre-wrap">
          {escapeHtml(styleGuide)}
        </p>
      )}
      {systemPromptAddon && (
        <p className="t-11 text-text-muted whitespace-pre-wrap italic">
          {escapeHtml(systemPromptAddon)}
        </p>
      )}
    </div>
  );
}
