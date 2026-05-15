"use client";

import type { CreativePromptPayload } from "@/lib/marketplace/types";
import type { ReportSpec } from "@/lib/reports/spec/schema";
import type { WorkflowGraph } from "@/lib/workflows/types";

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function Chip({ children }: { children: React.ReactNode }) {
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

export function WorkflowPreview({ graph }: { graph: WorkflowGraph }) {
  return (
    <ol
      className="flex flex-col gap-2 p-4 bg-bg-elev"
      style={{
        border: "1px solid var(--line-strong)",
        borderRadius: "var(--radius-md)",
      }}
    >
      {graph.nodes.map((n, i) => (
        <li key={n.id} className="flex items-baseline gap-2">
          <span className="t-9 font-mono text-text-faint">{String(i + 1).padStart(2, "0")}</span>
          <span className="t-11 font-medium text-(--accent-teal)">{n.kind}</span>
          <span className="t-11 text-text">{escapeHtml(n.label)}</span>
        </li>
      ))}
    </ol>
  );
}

export function ReportPreview({ spec }: { spec: ReportSpec }) {
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
          <li key={b.id} className="flex items-baseline gap-2">
            <span className="t-11 font-medium text-(--accent-teal)">{b.type}</span>
            <span className="t-11 text-text">{escapeHtml(b.label ?? b.id)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CreativePromptPreview({ payload }: { payload: CreativePromptPayload }) {
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

export function PersonaPreview({ payload }: { payload: Record<string, unknown> }) {
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
        <p className="t-11 text-text-soft whitespace-pre-wrap">{escapeHtml(styleGuide)}</p>
      )}
      {systemPromptAddon && (
        <p className="t-11 text-text-muted whitespace-pre-wrap italic">
          {escapeHtml(systemPromptAddon)}
        </p>
      )}
    </div>
  );
}
