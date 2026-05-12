"use client";

/**
 * Sub-rail Stage "asset" — méta du focal asset (titre, prompt, type,
 * dimensions / model / provider pour image-only ; sinon liste des
 * variantes prêtes).
 */

import { useStageData } from "@/stores/stage-data";
import { Section, EmptyHint } from "./Section";

export function ContextRailForAsset() {
  const { variants, assetTitle, assetSummary, assetCreatedAt, assetKind } =
    useStageData((s) => s.asset);
  const readyVariants = variants.filter((v) => v.status === "ready");
  const imageVariant = readyVariants.find((v) => v.kind === "image");
  const isImageOnly = !!imageVariant;

  const fmtDate = (ts?: number) => {
    if (!ts) return null;
    try {
      return new Intl.DateTimeFormat("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Paris",
      }).format(new Date(ts));
    } catch {
      return null;
    }
  };

  const variantMeta = (imageVariant?.metadata ?? {}) as {
    width?: number;
    height?: number;
    model?: string;
  };

  return (
    <div className="h-full overflow-y-auto">
      <Section label="Title">
        <p
          className="t-13 font-light text-text"
          style={{ lineHeight: "var(--leading-snug)" }}
        >
          {assetTitle || "—"}
        </p>
      </Section>

      {assetSummary && (
        <Section label="Prompt">
          <p
            className="t-11 font-light text-text-muted"
            style={{ lineHeight: "var(--leading-relaxed)" }}
          >
            {assetSummary}
          </p>
        </Section>
      )}

      {assetCreatedAt && (
        <Section label="Created">
          <p className="t-11 font-mono text-text-faint">
            {fmtDate(assetCreatedAt)}
          </p>
        </Section>
      )}

      {assetKind && (
        <Section label="Type">
          <p className="t-11 font-medium text-(--accent-teal)">
            {assetKind}
          </p>
        </Section>
      )}

      {isImageOnly && imageVariant && (
        <Section label="Image details">
          <ul className="flex flex-col gap-2">
            {variantMeta.width && variantMeta.height && (
              <li className="flex items-baseline gap-3">
                <span className="t-11 font-light text-text-faint">
                  Dimensions
                </span>
                <span className="t-11 font-mono text-text-muted">
                  {variantMeta.width}×{variantMeta.height}
                </span>
              </li>
            )}
            {variantMeta.model && (
              <li className="flex items-baseline gap-3">
                <span className="t-11 font-light text-text-faint">
                  Model
                </span>
                <span className="t-11 font-mono text-text-muted truncate">
                  {variantMeta.model}
                </span>
              </li>
            )}
            {imageVariant.provider && (
              <li className="flex items-baseline gap-3">
                <span className="t-11 font-light text-text-faint">
                  Provider
                </span>
                <span className="t-11 font-mono text-text-muted">
                  {imageVariant.provider}
                </span>
              </li>
            )}
          </ul>
        </Section>
      )}

      {!isImageOnly && (
        <Section label="Variants" count={readyVariants.length}>
          {readyVariants.length === 0 ? (
            <EmptyHint>
              Text only — generate audio/video/code via the tabs
            </EmptyHint>
          ) : (
            <ul className="flex flex-col gap-2">
              {readyVariants.map((v) => (
                <li key={v.id} className="flex items-baseline gap-3">
                  <span className="t-9 font-medium text-(--accent-teal)">
                    {v.kind.toUpperCase()}
                  </span>
                  <span className="t-11 text-text-faint tracking-wide">
                    {v.provider ?? ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}
    </div>
  );
}
