"use client";

import { useMemo } from "react";

const ISO_DATE_RE = /:\s*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)\s*$/;

type Source = { title: string; url: string };

// Format produit par run-research-report.ts : contentRef est du JSON
// `{ payload, narration, research }`. On extrait la narration markdown
// + les sources pour les rendre proprement au lieu d'afficher du JSON brut.
function extractContent(content: string): { markdown: string; sources?: Source[] } {
  if (!content.trimStart().startsWith("{")) return { markdown: content };
  try {
    const parsed = JSON.parse(content) as {
      narration?: unknown;
      research?: { sources?: unknown };
    };
    const markdown =
      typeof parsed.narration === "string" && parsed.narration.length > 0
        ? parsed.narration
        : content;
    const rawSources = parsed.research?.sources;
    const sources = Array.isArray(rawSources)
      ? rawSources.filter(
          (s): s is Source =>
            typeof s === "object" &&
            s !== null &&
            typeof (s as Source).title === "string" &&
            typeof (s as Source).url === "string",
        )
      : undefined;
    return { markdown, sources };
  } catch {
    return { markdown: content };
  }
}

type Block =
  | { kind: "h1"; text: string }
  | { kind: "h2"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "bullet"; text: string; meta?: string }
  | { kind: "p"; text: string };

function parse(content: string): Block[] {
  const lines = content.split("\n");
  const blocks: Block[] = [];
  let buffer: string[] = [];

  const flushParagraph = () => {
    if (buffer.length === 0) return;
    const text = buffer.join(" ").trim();
    if (text) blocks.push({ kind: "p", text });
    buffer = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushParagraph();
      continue;
    }
    if (line.startsWith("# ")) {
      flushParagraph();
      blocks.push({ kind: "h1", text: line.slice(2).trim() });
    } else if (line.startsWith("## ")) {
      flushParagraph();
      blocks.push({ kind: "h2", text: line.slice(3).trim() });
    } else if (line.startsWith("### ")) {
      flushParagraph();
      blocks.push({ kind: "h3", text: line.slice(4).trim() });
    } else if (line.startsWith("- ") || line.startsWith("• ")) {
      flushParagraph();
      const body = line.slice(2).trim();
      const match = body.match(ISO_DATE_RE);
      if (match) {
        const text = body.slice(0, match.index).replace(/[:\s]+$/, "").trim();
        blocks.push({ kind: "bullet", text, meta: formatDate(match[1]) });
      } else {
        blocks.push({ kind: "bullet", text: body });
      }
    } else {
      buffer.push(line);
    }
  }
  flushParagraph();
  return blocks;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export function ResearchReportArticle({ content }: { content: string }) {
  const { markdown, sources } = useMemo(() => extractContent(content), [content]);
  const blocks = useMemo(() => parse(markdown), [markdown]);

  return (
    <article className="flex flex-col gap-6 max-w-[var(--width-center-max)] text-[var(--text)]">
      {blocks.map((block, idx) => {
        switch (block.kind) {
          case "h1":
            return (
              <h1 key={idx} className="t-28 font-light leading-tight tracking-tight text-[var(--text)] mt-2">
                {block.text}
              </h1>
            );
          case "h2":
            return (
              <h2 key={idx} className="t-20 font-light leading-tight tracking-tight text-[var(--text)] mt-4">
                {block.text}
              </h2>
            );
          case "h3":
            return (
              <h3 key={idx} className="t-15 font-medium leading-snug text-[var(--text-soft)] mt-2">
                {block.text}
              </h3>
            );
          case "bullet":
            return (
              <div key={idx} className="flex items-baseline gap-3">
                <span className="t-9 font-mono text-[var(--accent-teal)] mt-1 shrink-0" aria-hidden="true">
                  ─
                </span>
                <div className="flex-1 flex flex-col gap-1">
                  <p className="t-15 leading-[1.6] font-light text-[var(--text-muted)]">
                    {block.text}
                  </p>
                  {block.meta && (
                    <span className="t-11 font-light text-[var(--text-faint)]">
                      {block.meta}
                    </span>
                  )}
                </div>
              </div>
            );
          case "p":
          default:
            return (
              <p key={idx} className="t-15 leading-[1.7] font-light text-[var(--text-muted)]">
                {block.text}
              </p>
            );
        }
      })}
      {sources && sources.length > 0 && (
        <section className="mt-8 pt-6 border-t border-[var(--line)] flex flex-col gap-3">
          <h3
            className="t-9 font-mono uppercase text-[var(--text-muted)]"
            style={{ letterSpacing: "var(--tracking-banner)" }}
          >
            Sources · {sources.length}
          </h3>
          <ul className="flex flex-col gap-2">
            {sources.map((s, i) => (
              <li key={i} className="flex items-baseline gap-3">
                <span className="t-9 font-mono text-[var(--text-faint)] shrink-0" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="t-13 font-light text-[var(--text-soft)] hover:text-[var(--accent-teal)] underline underline-offset-2 decoration-[var(--line)] hover:decoration-[var(--accent-teal)]"
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
