/**
 * HearstMark — logo officiel Hearst (le « H »).
 * Source : ~/.claude/assets/hearst/hcyan.svg (référence de marque).
 * Mono-path → hérite de `currentColor`, donc teinté à l'accent du produit.
 */
export function HearstMark({ size = 22 }: { size?: number }) {
  return (
    <svg
      height={size}
      width={Math.round((size * 155) / 170)}
      viewBox="560 455 155 170"
      fill="currentColor"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <polygon points="601.74 466.87 572.6 466.87 572.6 609.73 601.74 609.73 601.74 549.07 633.11 579.43 665.76 579.43 601.74 517.46 601.74 466.87" />
      <polygon points="672.72 466.87 672.72 528.12 644.63 500.93 611.98 500.93 672.72 559.72 672.72 609.73 701.86 609.73 701.86 466.87 672.72 466.87" />
    </svg>
  );
}
