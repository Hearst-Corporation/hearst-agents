"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RUN_SERVICES, type RunService } from "@/lib/runs/service";

const SERVICE_LABELS: Record<RunService | "all", string> = {
  all: "Tous",
  swarms: "Swarms",
  action: "Action",
  helm: "Helm",
  jobs: "Jobs",
  other: "Autre",
};

export function RunServiceFilter({ active }: { active: RunService | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function select(value: RunService | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set("service", value);
    } else {
      params.delete("service");
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  const chips: Array<{ value: RunService | null; label: string }> = [
    { value: null, label: SERVICE_LABELS.all },
    ...RUN_SERVICES.map((s) => ({ value: s, label: SERVICE_LABELS[s] })),
  ];

  return (
    <div className="flex flex-wrap items-center gap-(--space-2)">
      {chips.map(({ value, label }) => {
        const isActive = value === active;
        return (
          <button
            key={value ?? "all"}
            type="button"
            onClick={() => select(value)}
            className={[
              "px-(--space-3) py-(--space-1) rounded-(--radius-xs) t-11 font-medium transition-colors",
              "border",
              isActive
                ? "border-(--accent-teal) bg-(--accent-teal)/15 text-(--accent-teal)"
                : "border-(--border-shell) bg-(--bg-elev) text-text-muted hover:border-(--accent-teal)/50 hover:text-text",
            ].join(" ")}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
