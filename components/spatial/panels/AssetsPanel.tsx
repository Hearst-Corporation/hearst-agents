"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { relativeTime } from "@/lib/spatial/utils";
import { useFocalStore } from "@/stores/focal";
import { useNavigationStore } from "@/stores/navigation";
import { useStageStore } from "@/stores/stage";
import { BentoCard } from "./BentoCard";

interface AssetsPanelProps {
  show: boolean;
}

interface AssetEntry {
  id: string;
  label: string;
  time: string;
  ts: number;
}

const EMPTY_SECONDARY: never[] = [];

/**
 * Assets — bento wide (col 2 × row 1).
 *
 * Source : `useFocalStore.secondary` (focal historique) + assetRefs des messages.
 * Click sur asset → ouvre le focal stage `/?...` via setMode(asset).
 */
export function AssetsPanel({ show }: AssetsPanelProps) {
  const router = useRouter();
  const secondary = useFocalStore((s) => s.secondary) ?? EMPTY_SECONDARY;
  const activeThreadId = useNavigationStore((s) => s.activeThreadId);
  const messages = useNavigationStore((s) =>
    activeThreadId ? s.messages[activeThreadId] : undefined,
  );

  const assets: AssetEntry[] = useMemo(() => {
    // Base ts pure : on attribue un ranking décrémental aux refs sans timestamp
    // pour qu'elles trient en ordre d'apparition. Évite l'appel impur à Date.now()
    // pendant le render (rule react-hooks/purity).
    const messageRefs = (messages ?? []).filter((m) => !!m.assetRef).slice(-5);
    const fromMessages: AssetEntry[] = messageRefs.map((m, i) => ({
      id: m.assetRef?.id,
      label: m.assetRef?.title || "Asset",
      time: "récent",
      // Base 0 + i pour préserver l'ordre relatif sans Date.now()
      ts: i,
    }));

    const fromFocal: AssetEntry[] = secondary.map((o) => ({
      id: o.id,
      label: o.title,
      time: relativeTime(o.updatedAt),
      ts: o.updatedAt,
    }));

    // Dédup par id, garde le plus récent, tri desc
    const map = new Map<string, AssetEntry>();
    for (const a of [...fromFocal, ...fromMessages]) {
      const existing = map.get(a.id);
      if (!existing || existing.ts < a.ts) map.set(a.id, a);
    }
    return Array.from(map.values())
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 4);
  }, [secondary, messages]);

  if (assets.length === 0 && !show) return null;

  function openAsset(id: string) {
    useStageStore.getState().setMode({ mode: "asset", assetId: id });
    router.push("/");
  }

  const count = assets.length;

  return (
    <BentoCard show={show} colSpan={2} rowSpan={1} delay={0.32}>
      <div className="flex h-full flex-col justify-between">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="mb-2 text-spatial-xs font-semibold uppercase tracking-[0.2em] text-white/45">
              Assets
            </div>
            <div className="text-spatial-2xl font-extralight tracking-tight text-white/95">
              {count > 0
                ? `${count} document${count > 1 ? "s" : ""} récent${count > 1 ? "s" : ""}`
                : "Aucun document récent"}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {assets.map((a) => (
            <button
              type="button"
              key={a.id}
              onClick={() => openAsset(a.id)}
              className="flex items-baseline justify-between gap-6 border-t border-white/5 pt-2 first:border-t-0 first:pt-0 cursor-pointer text-left transition-colors duration-300 hover:text-white"
            >
              <div className="truncate text-spatial-base font-light tracking-wide text-white/85">
                {a.label}
              </div>
              <div className="shrink-0 text-spatial-sm font-light text-white/45">{a.time}</div>
            </button>
          ))}
        </div>
      </div>
    </BentoCard>
  );
}
