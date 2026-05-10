"use client";

/**
 * MissionBudgetBadge — indicateur visuel "€X / €Y" + barre 3 segments
 * pour les missions ayant un `budgetUsd` configuré (S3-D).
 *
 * Couleurs :
 *  - teal    < 70%
 *  - gold    70%–90%
 *  - danger  > 90% (ou exceeded)
 *
 * Composant pure UI : reçoit `currentUsd` / `budgetUsd` déjà calculés.
 * L'agrégation runs vit dans `lib/engine/runtime/missions/budget.ts`.
 */

interface MissionBudgetBadgeProps {
  currentUsd: number;
  budgetUsd: number;
}

const SEGMENT_COUNT = 3;
const WARN_THRESHOLD = 0.7;
const DANGER_THRESHOLD = 0.9;

export function MissionBudgetBadge({ currentUsd, budgetUsd }: MissionBudgetBadgeProps) {
  if (!budgetUsd || budgetUsd <= 0) return null;

  const ratio = Math.max(0, currentUsd / budgetUsd);
  const tone = pickTone(ratio);
  const filledSegments = ratioToSegments(ratio);

  return (
    <span
      className="inline-flex items-center shrink-0"
      style={{ gap: "var(--space-2)" }}
      aria-label={`Budget mensuel ${formatUsd(currentUsd)} sur ${formatUsd(budgetUsd)}`}
      title={`${formatUsd(currentUsd)} / ${formatUsd(budgetUsd)} ce mois`}
    >
      <span
        className="t-11 font-mono tabular-nums"
        style={{ color: tone.color }}
      >
        {formatUsd(currentUsd)} / {formatUsd(budgetUsd)}
      </span>
      <span
        className="inline-flex"
        style={{ gap: "var(--space-0-5)" }}
        aria-hidden
      >
        {Array.from({ length: SEGMENT_COUNT }).map((_, i) => (
          <span
            key={i}
            style={{
              display: "inline-block",
              width: "var(--size-progress-segment-w)",
              height: "var(--size-progress-segment-h)",
              borderRadius: "var(--radius-xs)",
              background: i < filledSegments ? tone.color : "var(--border-soft)",
            }}
          />
        ))}
      </span>
    </span>
  );
}

interface Tone {
  color: string;
}

function pickTone(ratio: number): Tone {
  if (ratio >= DANGER_THRESHOLD) return { color: "var(--danger)" };
  if (ratio >= WARN_THRESHOLD) return { color: "var(--gold)" };
  return { color: "var(--accent-teal)" };
}

function ratioToSegments(ratio: number): number {
  if (ratio <= 0) return 0;
  if (ratio >= 1) return SEGMENT_COUNT;
  // 0..0.33 → 1, 0.33..0.66 → 2, 0.66..1 → 3
  return Math.min(SEGMENT_COUNT, Math.max(1, Math.ceil(ratio * SEGMENT_COUNT)));
}

function formatUsd(v: number): string {
  if (v >= 100) return `$${Math.round(v)}`;
  return `$${v.toFixed(2)}`;
}
