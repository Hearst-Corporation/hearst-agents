"use client";

import { Action } from "@/app/(user-legacy)/components/ui";
import type { MarketplaceRating } from "@/lib/marketplace/types";
import { escapeHtml } from "./TemplatePreviews";

interface RatingSectionProps {
  rating: number;
  comment: string;
  busy: boolean;
  onSetRating: (n: number) => void;
  onSetComment: (v: string) => void;
  onRate: () => void;
}

export function RatingSection({
  rating,
  comment,
  busy,
  onSetRating,
  onSetComment,
  onRate,
}: RatingSectionProps) {
  return (
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
            onClick={() => onSetRating(n)}
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
        onChange={(e) => onSetComment(e.target.value)}
        rows={2}
        placeholder="Commentaire (optionnel)…"
        maxLength={500}
        className="block w-full bg-transparent t-13 text-text focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-teal-border-hover)] resize-none"
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
          onClick={onRate}
          disabled={rating === 0}
          loading={busy}
          testId="rate-submit"
        >
          Envoyer la note
        </Action>
      </div>
    </section>
  );
}

interface RatingsListProps {
  ratings: MarketplaceRating[];
}

export function RatingsList({ ratings }: RatingsListProps) {
  if (ratings.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="t-13 text-text-soft">Notes ({ratings.length})</h2>
      <ul className="flex flex-col gap-2">
        {ratings.map((r) => (
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
            {r.comment && <p className="t-11 text-text-soft">{escapeHtml(r.comment)}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
