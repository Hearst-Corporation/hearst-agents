"use client";

import { useNavigationStore } from "@/stores/navigation";
import { type CoreState, useRuntimeStore } from "@/stores/runtime";

// États où l'action principale est "Annuler" (suspension en attente d'input)
const CANCEL_STATES: CoreState[] = ["awaiting_approval", "awaiting_clarification"];
// États actifs (pas idle, pas error)
const ACTIVE_STATES: CoreState[] = [
  "connecting",
  "streaming",
  "processing",
  "awaiting_approval",
  "awaiting_clarification",
];

interface StateConfig {
  label: string;
  tone: "accent-teal" | "gold" | "danger" | "muted";
  pattern: "heartbeat" | "wave-fast" | "wave-medium" | "wave-slow" | "static" | "pulse-mid";
}

const STATE_MAP: Record<CoreState, StateConfig> = {
  idle: { label: "Online", tone: "accent-teal", pattern: "heartbeat" },
  connecting: { label: "Connecting", tone: "accent-teal", pattern: "wave-medium" },
  streaming: { label: "Running", tone: "accent-teal", pattern: "wave-fast" },
  processing: { label: "Processing", tone: "accent-teal", pattern: "wave-slow" },
  awaiting_approval: { label: "Approval required", tone: "gold", pattern: "static" },
  awaiting_clarification: {
    label: "Clarification required",
    tone: "accent-teal",
    pattern: "pulse-mid",
  },
  error: { label: "Error", tone: "danger", pattern: "static" },
};

const TONE_VAR: Record<StateConfig["tone"], string> = {
  "accent-teal": "var(--accent-teal)",
  gold: "var(--gold)",
  danger: "var(--danger)",
  muted: "var(--text-faint)",
};

export function StageFooter() {
  const coreState = useRuntimeStore((s) => s.coreState);
  const flowLabel = useRuntimeStore((s) => s.flowLabel);
  const stopRun = useRuntimeStore((s) => s.stopRun);
  const completeRun = useRuntimeStore((s) => s.completeRun);
  const config = STATE_MAP[coreState];
  const color = TONE_VAR[config.tone];
  const leftCollapsed = useNavigationStore((s) => s.leftCollapsed);

  const leftSpacer = leftCollapsed ? "var(--width-threads-collapsed)" : "var(--width-threads)";
  const rightSpacer = "var(--width-context)";
  const labelText = flowLabel && coreState !== "idle" ? flowLabel : config.label;

  const isActive = ACTIVE_STATES.includes(coreState);
  const isError = coreState === "error";
  const isCancel = CANCEL_STATES.includes(coreState);

  const actionLabel = isError ? "Réinitialiser" : isCancel ? "Annuler" : "Arrêter";
  const handleAction = isError ? completeRun : stopRun;

  return (
    <footer
      className="shrink-0 flex items-stretch"
      style={{
        height: "var(--height-stage-footer)",
        borderTop: "1px solid var(--border-subtle)",
        background: "var(--rail)",
        color: "var(--text-soft)",
      }}
      aria-live="polite"
      aria-label={labelText}
    >
      <div className="shrink-0" style={{ width: leftSpacer }} aria-hidden />
      <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
        <DotsCluster pattern={config.pattern} color={color} />
        <span className="t-11 font-light" style={{ color: "var(--text-faint)" }}>
          {labelText}
        </span>
        {(isActive || isError) && (
          <>
            <span
              className="t-11 font-light"
              style={{ color: "var(--text-faint)", opacity: 0.5 }}
              aria-hidden
            >
              ·
            </span>
            <button
              type="button"
              onClick={handleAction}
              className="t-11 font-light transition-colors duration-[var(--duration-fast)]"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "var(--danger)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
              }}
              aria-label={actionLabel}
            >
              {actionLabel}
            </button>
          </>
        )}
      </div>
      <div className="shrink-0" style={{ width: rightSpacer }} aria-hidden />
    </footer>
  );
}

function DotsCluster({ pattern, color }: { pattern: StateConfig["pattern"]; color: string }) {
  const delays = [0, 150, 300];
  return (
    <span className="inline-flex items-center" style={{ gap: "var(--space-1)" }} aria-hidden>
      {delays.map((delay, i) => (
        <span
          key={i}
          className={`sf-dot sf-dot-${pattern}`}
          data-index={i}
          style={{ background: color, animationDelay: `${delay}ms` } as React.CSSProperties}
        />
      ))}
    </span>
  );
}
