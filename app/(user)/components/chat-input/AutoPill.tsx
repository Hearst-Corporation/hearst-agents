"use client";

import { useVoiceStore } from "@/stores/voice";

/**
 * Pill "Auto" qui toggle le mode voix global.
 * Halo cyan = état actif intentionnel (voix on).
 */
export function AutoPill() {
  const voiceActive = useVoiceStore((s) => s.voiceActive);
  const setVoiceActive = useVoiceStore((s) => s.setVoiceActive);
  return (
    <button
      type="button"
      onClick={() => setVoiceActive(!voiceActive)}
      aria-pressed={voiceActive}
      className="flex items-center gap-1 transition-[background-color,border-color,color] duration-(--duration-slow) ease-(--ease-standard)"
      style={{
        padding: "var(--space-1) var(--space-3)",
        borderRadius: "var(--radius-pill)",
        border: `1px solid ${voiceActive ? "var(--accent-teal-border)" : "var(--border-soft)"}`,
        background: voiceActive ? "var(--accent-teal-bg-active)" : "transparent",
        color: voiceActive ? "var(--accent-teal)" : "var(--text-l2)",
      }}
    >
      {voiceActive && (
        <span
          className="rounded-pill animate-pulse"
          style={{
            width: "var(--space-1)",
            height: "var(--space-1)",
            background: "var(--accent-teal)",
          }}
          aria-hidden
        />
      )}
      <span className="t-9 font-medium">Auto</span>
    </button>
  );
}
