"use client";

import { PROMPT_TRUNCATE_LENGTH } from "./shared";

interface GenerationPromptBlockProps {
  prompt: string | undefined;
  expanded: boolean;
  copied: boolean;
  onToggleExpand: () => void;
  onCopy: (prompt: string) => Promise<void>;
}

/**
 * GenerationPromptBlock — Affiche le prompt de génération (Runway / HeyGen /
 * fal.ai / ElevenLabs) stocké dans `asset.provenance.metadata.prompt`.
 *
 * Null-safe : ne rend rien si `prompt` est vide ou absent.
 * Troncation à `PROMPT_TRUNCATE_LENGTH` caractères avec bouton
 * "Voir plus / Réduire". Bouton copier avec retour visuel (2s).
 */
export function GenerationPromptBlock({
  prompt,
  expanded,
  copied,
  onToggleExpand,
  onCopy,
}: GenerationPromptBlockProps) {
  if (!prompt || typeof prompt !== "string" || !prompt.trim()) return null;

  const needsTruncation = prompt.length > PROMPT_TRUNCATE_LENGTH;
  const displayedPrompt =
    needsTruncation && !expanded ? `${prompt.slice(0, PROMPT_TRUNCATE_LENGTH)}…` : prompt;

  return (
    <div
      className="mb-10"
      style={{
        border: "1px solid var(--border-shell)",
        borderRadius: "var(--radius-xs)",
        background: "var(--surface-1)",
        overflow: "hidden",
      }}
    >
      {/* En-tête du bloc */}
      <div
        className="flex items-center justify-between"
        style={{
          padding: "var(--space-3) var(--space-4)",
          borderBottom: "1px solid var(--border-shell)",
        }}
      >
        <span className="t-9 font-medium text-(--text-faint)">Prompt utilisé</span>
        <button
          type="button"
          aria-label={copied ? "Copié" : "Copier le prompt"}
          onClick={() => void onCopy(prompt)}
          className="t-9 font-medium transition-colors"
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: copied ? "var(--accent-teal)" : "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-1)",
            padding: "0",
          }}
        >
          {/* Icône clipboard SVG inline — pas de dépendance externe */}
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            style={{ flexShrink: 0 }}
          >
            {copied ? (
              /* Check icon */
              <path
                d="M2 8l4 4 8-8"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : (
              /* Clipboard icon */
              <>
                <rect x="5" y="3" width="8" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
                <path
                  d="M5 5H4a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-1"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </>
            )}
          </svg>
          {copied ? "Copié" : "Copier"}
        </button>
      </div>

      {/* Corps du prompt */}
      <div style={{ padding: "var(--space-3) var(--space-4)" }}>
        <p
          className="t-11 font-light text-(--text-soft)"
          style={{
            fontFamily: "var(--font-mono, ui-monospace, monospace)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            lineHeight: "var(--leading-relaxed, 1.6)",
          }}
        >
          {displayedPrompt}
        </p>
        {needsTruncation && (
          <button
            type="button"
            onClick={onToggleExpand}
            className="t-9 font-medium transition-colors"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--accent-teal)",
              padding: "var(--space-2) 0 0 0",
              display: "block",
            }}
          >
            {expanded ? "Réduire" : "Voir plus"}
          </button>
        )}
      </div>
    </div>
  );
}
