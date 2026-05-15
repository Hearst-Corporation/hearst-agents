"use client";

interface AnalyticsKpiCardProps {
  label: string;
  value: string;
  sub?: string;
  accent?: "default" | "accent-teal" | "warn" | "danger";
  /** "lg" = t-28 pour dashboard analytics, "md" = t-24 pour grilles compactes (défaut) */
  size?: "md" | "lg";
}

export function AnalyticsKpiCard({
  label,
  value,
  sub,
  accent = "default",
  size = "md",
}: AnalyticsKpiCardProps) {
  const valueColor =
    accent === "accent-teal"
      ? "text-(--accent-teal)"
      : accent === "warn"
        ? "text-(--warn)"
        : accent === "danger"
          ? "text-(--danger)"
          : "text-text";

  return (
    <div className="rounded-(--radius-md) bg-surface-1 border border-(--border-shell) p-(--space-4) flex flex-col gap-(--space-2)">
      <span className="t-11 font-medium text-text-faint">{label}</span>
      <span
        className={`font-light ${size === "lg" ? "t-28 tracking-tight" : "t-24"} ${valueColor}`}
      >
        {value}
      </span>
      {sub && <span className="t-10 text-text-ghost">{sub}</span>}
    </div>
  );
}
