"use client";

import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import { useStageStore } from "@/stores/stage";
import { LEFT_RAIL_ORDER, STAGE_REGISTRY } from "../_stages/registry";
import type { StageKey } from "../_stages/types";

/**
 * LeftRail visionOS — 88px de large, glass, 12 slots cliquables.
 *
 * Port direct de `lab/cli-os/src/components/LeftRail.tsx` (icônes + hover
 * states). Chaque slot change le `mode` du store via `setMode`.
 */

// ── Icônes par stage (port du lab/cli-os) ──────────────────────────────────

function StageIcon({ stage, active }: { stage: StageKey; active: boolean }) {
  const stroke = active ? "rgba(255,255,255,0.95)" : "currentColor";
  const fill = active ? "rgba(255,255,255,0.95)" : "currentColor";

  switch (stage) {
    case "cockpit":
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <rect x="2" y="2" width="14" height="14" rx="2" stroke={stroke} strokeWidth="1.5" />
        </svg>
      );
    case "chat":
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <line
            x1="3"
            y1="6"
            x2="15"
            y2="6"
            stroke={stroke}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <line
            x1="3"
            y1="9"
            x2="15"
            y2="9"
            stroke={stroke}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <line
            x1="3"
            y1="12"
            x2="10"
            y2="12"
            stroke={stroke}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case "mission":
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="9" cy="9" r="6" stroke={stroke} strokeWidth="1.5" />
        </svg>
      );
    case "asset":
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <rect x="3" y="3" width="12" height="12" rx="1" stroke={stroke} strokeWidth="1.5" />
          <rect x="6" y="6" width="6" height="6" rx="0.5" stroke={stroke} strokeWidth="1" />
        </svg>
      );
    case "browser":
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <polygon
            points="4,14 14,9 4,4"
            stroke={stroke}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "voice":
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="9" cy="9" r="4" fill={fill} />
        </svg>
      );
    case "meeting":
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <line
            x1="3"
            y1="9"
            x2="15"
            y2="9"
            stroke={stroke}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case "artifact":
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <rect x="2" y="2" width="14" height="14" rx="1" stroke={stroke} strokeWidth="1.5" />
          <polyline
            points="6,11 8,9 6,7"
            stroke={stroke}
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <line
            x1="10"
            y1="11"
            x2="12"
            y2="11"
            stroke={stroke}
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      );
    case "kg":
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="9" cy="9" r="5.5" stroke={stroke} strokeWidth="1.5" />
          <circle cx="9" cy="9" r="2" stroke={stroke} strokeWidth="1" />
        </svg>
      );
    case "simulation":
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <rect x="2" y="6" width="14" height="6" rx="1" stroke={stroke} strokeWidth="1.5" />
          <line
            x1="5"
            y1="9"
            x2="13"
            y2="9"
            stroke={stroke}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case "signal":
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <polygon
            points="9,3 16,15 2,15"
            stroke={stroke}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "asset_compare":
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <rect x="2" y="2" width="6" height="14" rx="1" stroke={stroke} strokeWidth="1.5" />
          <rect x="10" y="2" width="6" height="14" rx="1" stroke={stroke} strokeWidth="1.5" />
        </svg>
      );
    default:
      return <span className="block size-4 rounded-[3px] border border-current opacity-40" />;
  }
}

// ── Payload builder ─────────────────────────────────────────────────────────

function buildPayload(mode: StageKey, lastAssetId: string | null, lastMissionId: string | null) {
  switch (mode) {
    case "cockpit":
    case "chat":
    case "browser":
    case "meeting":
    case "kg":
    case "voice":
    case "simulation":
    case "artifact":
    case "signal":
      if (mode === "browser") return { mode: "browser" as const, sessionId: "" };
      if (mode === "meeting") return { mode: "meeting" as const, meetingId: "" };
      return { mode } as { mode: typeof mode };
    case "asset":
      return { mode: "asset" as const, assetId: lastAssetId ?? "" };
    case "asset_compare":
      return { mode: "asset_compare" as const, assetIds: [] };
    case "mission":
      return { mode: "mission" as const, missionId: lastMissionId ?? "" };
  }
}

function UserAvatar() {
  const { data: session } = useSession();
  const image = session?.user?.image;
  const name = session?.user?.name ?? "?";
  const initial = name.charAt(0).toUpperCase();

  if (image) {
    return (
      <img
        src={image}
        alt={name}
        className="size-12 rounded-full object-cover"
        style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2)" }}
      />
    );
  }
  return (
    <div className="flex size-12 items-center justify-center rounded-full bg-[rgba(255,255,255,0.15)] text-base text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
      <span className="opacity-90">{initial}</span>
    </div>
  );
}

export function LeftRail() {
  const activeMode = useStageStore((s) => s.current.mode);
  const lastAssetId = useStageStore((s) => s.lastAssetId);
  const lastMissionId = useStageStore((s) => s.lastMissionId);
  const setMode = useStageStore((s) => s.setMode);

  return (
    <aside aria-label="Navigation principale" className="relative z-20 h-full w-[88px] shrink-0">
      <div className="vision-glass vision-rail-left preserve-3d flex h-full w-full flex-col items-center gap-3 border-y-0 border-l-0 py-8">
        {/* Brand logo */}
        <div className="mb-6 flex size-8 items-center justify-center" aria-hidden>
          <span className="text-lg font-bold text-white/80">H</span>
        </div>

        {LEFT_RAIL_ORDER.map((key) => {
          const active = activeMode === key;
          const def = STAGE_REGISTRY[key];
          const label = def.hotkey ? `${def.label} (${def.hotkey})` : def.label;
          return (
            <motion.button
              whileTap={{ scale: 0.92 }}
              key={key}
              type="button"
              onClick={() => setMode(buildPayload(key, lastAssetId, lastMissionId))}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              title={label}
              className={`group relative flex size-14 items-center justify-center rounded-xl transition-all duration-200 ${
                active
                  ? "vision-btn-glass z-10 text-white"
                  : "text-[rgba(255,255,255,0.45)] hover:bg-[rgba(255,255,255,0.06)] hover:text-white"
              }`}
            >
              <StageIcon stage={key} active={active} />
            </motion.button>
          );
        })}

        <div className="flex-1" />

        {/* Avatar bottom */}
        <div className="mt-4">
          <UserAvatar />
        </div>
      </div>
    </aside>
  );
}
