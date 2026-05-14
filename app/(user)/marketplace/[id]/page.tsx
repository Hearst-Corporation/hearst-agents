"use client";

/**
 * /marketplace/[id] — détail d'un template + actions (cloner, noter, signaler).
 */

import { use, useEffect, useState } from "react";
import { PageHeader } from "../../components/PageHeader";
import { Action } from "../../components/ui";
import type { CreativePromptPayload } from "@/lib/marketplace/types";
import type { WorkflowGraph } from "@/lib/workflows/types";
import type { ReportSpec } from "@/lib/reports/spec/schema";
import { Chip, WorkflowPreview, ReportPreview, CreativePromptPreview, PersonaPreview, escapeHtml } from "./_parts/TemplatePreviews";
import { RatingSection, RatingsList } from "./_parts/RatingSection";
import { ReportForm } from "./_parts/ReportForm";
import { useTemplateActions, type DetailResponse } from "./_parts/useTemplateActions";

interface PageProps {
  params: Promise<{ id: string }>;
}

const KIND_LABELS: Record<string, string> = {
  workflow: "Workflow",
  report_spec: "Rapport",
  persona: "Persona",
  creative_prompt: "Pack créatif",
};

export default function MarketplaceDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const [data, setData] = useState<DetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Rate form
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState("");

  // Report form
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");

  const { flash, busy, handleClone, handleRate, handleUseCreativePack, handleReport } =
    useTemplateActions(id, data, setData);

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

  if (error) {
    return (
      <div className="h-full min-h-0 overflow-y-auto bg-bg-elev text-text">
        <PageHeader
          title="Marketplace"
          back={{ label: "Marketplace", href: "/marketplace" }}
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
          back={{ label: "Marketplace", href: "/marketplace" }}
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

      <div className="px-12 py-8 mx-auto w-full max-w-[min(100%,var(--width-actions))] flex flex-col gap-6">
        {flash && (
          <p className="t-11 font-light text-(--accent-teal)">
            {flash}
          </p>
        )}

        {/* Méta */}
        <section className="flex flex-wrap gap-3">
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

        {reportOpen && (
          <ReportForm
            reason={reportReason}
            busy={busy}
            onChangeReason={setReportReason}
            onSubmit={() => void handleReport(reportReason, () => {
              setReportOpen(false);
              setReportReason("");
            })}
            onCancel={() => setReportOpen(false)}
          />
        )}

        <RatingSection
          rating={rating}
          comment={comment}
          busy={busy}
          onSetRating={setRating}
          onSetComment={setComment}
          onRate={() => void handleRate(rating, comment)}
        />

        <RatingsList ratings={data.ratings} />
      </div>
    </div>
  );
}
