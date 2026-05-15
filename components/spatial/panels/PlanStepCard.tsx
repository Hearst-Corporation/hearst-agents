"use client";

import type { PlanStepState } from "@/stores/runtime";
import { BentoCard } from "./BentoCard";

interface PlanStepCardProps {
  step: PlanStepState;
  delay?: number;
}

const KIND_ICON: Record<string, string> = {
  llm: "∿",
  tool: "◇",
  search: "⌕",
  email: "✉",
  message: "◆",
  fetch: "↓",
  generate: "✦",
  approval: "!",
};

function kindIcon(kind: string): string {
  for (const [k, v] of Object.entries(KIND_ICON)) {
    if (kind.toLowerCase().includes(k)) return v;
  }
  return "◇";
}

/**
 * Bento step éphémère — affiché pendant qu'un step de plan tourne.
 * Pulse cyan si awaiting_approval.
 */
export function PlanStepCard({ step, delay = 0 }: PlanStepCardProps) {
  const isAwaiting = step.status === "awaiting_approval";
  const isRunning = step.status === "running";

  return (
    <BentoCard show={true} colSpan={1} rowSpan={1} delay={delay}>
      <div className="flex h-full flex-col justify-between">
        <div className="flex items-start gap-3">
          <div
            className="text-spatial-2xl leading-none"
            style={{
              color: isAwaiting ? "rgba(120,220,220,0.95)" : "rgba(255,255,255,0.85)",
              textShadow: isAwaiting ? "0 0 12px rgba(120,220,220,0.6)" : undefined,
            }}
          >
            {kindIcon(step.kind)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-spatial-xs font-semibold uppercase tracking-[0.2em] text-white/45">
              {step.kind}
            </div>
            <div className="mt-1 text-spatial-base font-light tracking-tight text-white/95 line-clamp-3">
              {step.label}
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background: isAwaiting
                  ? "rgba(120,220,220,0.9)"
                  : isRunning
                    ? "rgba(255,255,255,0.9)"
                    : "rgba(255,255,255,0.4)",
                boxShadow: isAwaiting
                  ? "0 0 10px rgba(120,220,220,0.7)"
                  : isRunning
                    ? "0 0 8px rgba(255,255,255,0.6)"
                    : undefined,
                animation:
                  isRunning || isAwaiting
                    ? "spatial-mission-pulse 2.4s ease-in-out infinite"
                    : undefined,
              }}
            />
            <div className="text-spatial-sm font-light text-white/55">
              {isAwaiting ? "Validation" : isRunning ? "En cours" : step.status}
            </div>
          </div>
          {step.providerId && (
            <div className="text-spatial-xs font-light tracking-wider uppercase text-white/35">
              {step.providerId}
            </div>
          )}
        </div>
      </div>
    </BentoCard>
  );
}
