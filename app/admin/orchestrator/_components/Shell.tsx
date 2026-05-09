import Link from "next/link";

const TABS = [
  { href: "/admin/orchestrator/overview", label: "Vue d'ensemble" },
  { href: "/admin/orchestrator/command-center", label: "Command Center" },
  { href: "/admin/orchestrator/registry", label: "Registry" },
  { href: "/admin/orchestrator/agents", label: "Agents" },
  { href: "/admin/orchestrator/runs", label: "Runs" },
  { href: "/admin/orchestrator/trust", label: "Trust" },
  { href: "/admin/orchestrator/drift", label: "Drift" },
  { href: "/admin/orchestrator/telemetry", label: "Telemetry" },
  { href: "/admin/orchestrator/quarantine", label: "Quarantaine" },
  { href: "/admin/orchestrator/release", label: "Release" },
];

export function HomShell({
  current,
  children,
}: {
  current: string;
  children: React.ReactNode;
}) {
  return (
    <div className="h-full min-h-0 overflow-y-auto bg-bg text-text">
      <div className="px-(--space-8) pt-(--space-8) pb-(--space-4) border-b border-(--line)">
        <div className="flex items-baseline gap-(--space-4)">
          <h1 className="t-24 font-light text-text">Orchestrateur</h1>
          <span className="t-10 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
            Hearst Operations Mesh · v1.2
          </span>
        </div>
        <nav className="mt-(--space-4) flex flex-wrap gap-(--space-1)">
          {TABS.map((tab) => {
            const active = current === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={
                  active
                    ? "px-(--space-3) py-(--space-1) rounded-(--radius-pill) bg-(--accent-teal-bg-active) text-(--accent-teal) t-12"
                    : "px-(--space-3) py-(--space-1) rounded-(--radius-pill) text-text-muted hover:text-text hover:bg-surface-1 t-12 transition-colors"
                }
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="px-(--space-8) py-(--space-6)">{children}</div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-(--space-6)">
      <h2 className="t-15 font-light text-text">{title}</h2>
      {subtitle ? (
        <p className="t-12 text-text-muted mt-(--space-1)">{subtitle}</p>
      ) : null}
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-(--radius-md) bg-surface-1 border border-(--line) p-(--space-5) ${className}`}
    >
      {children}
    </div>
  );
}

export function MetricCell({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  tone?: "neutral" | "ok" | "warn" | "bad";
}) {
  const colorClass =
    tone === "ok"
      ? "text-(--accent-teal)"
      : tone === "warn"
        ? "text-(--warn)"
        : tone === "bad"
          ? "text-(--danger)"
          : "text-text";
  return (
    <div className="rounded-(--radius-md) bg-surface-1 border border-(--line) p-(--space-4) flex flex-col gap-(--space-1)">
      <span className="t-9 font-mono uppercase tracking-(--tracking-stretch) text-text-faint">
        {label}
      </span>
      <span className={`t-24 font-light ${colorClass}`}>{value}</span>
    </div>
  );
}

export function StatusPill({
  status,
}: {
  status: "green" | "amber" | "red" | "stale" | "quarantined";
}) {
  const map = {
    green: "bg-(--accent-teal-bg-active) text-(--accent-teal)",
    amber: "bg-(--warn-surface) text-(--warn)",
    red: "bg-(--danger-surface) text-(--danger)",
    stale: "bg-surface-1 text-text-faint",
    quarantined: "bg-(--quarantine-surface) text-(--accent-llm)",
  } as const;
  const labels = {
    green: "vert",
    amber: "ambre",
    red: "rouge",
    stale: "inactif",
    quarantined: "quarantaine",
  } as const;
  return (
    <span
      className={`inline-block px-(--space-2) py-(--space-0) rounded-(--radius-pill) t-10 font-mono ${map[status]}`}
    >
      {labels[status]}
    </span>
  );
}
