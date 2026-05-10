"use client";

import { useEffect, useRef, useState } from "react";
import type { AssetVariant } from "@/lib/assets/variants";

interface VideoPlayerProps {
  variant: AssetVariant;
}

function formatDuration(seconds?: number): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function PiPIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden
      style={{ color: "inherit" }}
    >
      {/* Écran principal */}
      <rect
        x="1"
        y="2"
        width="12"
        height="10"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.25"
        fill="none"
      />
      {/* Fenêtre PiP */}
      <rect
        x="7"
        y="6.5"
        width="4.5"
        height="3.5"
        rx="0.5"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1"
      />
    </svg>
  );
}

export function VideoPlayer({ variant }: VideoPlayerProps) {
  const isReady = variant.status === "ready" && !!variant.storageUrl;
  const isFailed = variant.status === "failed";
  const meta = (variant.metadata ?? {}) as { provider?: string; duration?: number };

  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPiP, setIsPiP] = useState(false);
  const [pipSupported] = useState(
    () => typeof document !== "undefined" && !!document.pictureInPictureEnabled,
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onEnter = () => setIsPiP(true);
    const onLeave = () => setIsPiP(false);

    video.addEventListener("enterpictureinpicture", onEnter);
    video.addEventListener("leavepictureinpicture", onLeave);

    return () => {
      video.removeEventListener("enterpictureinpicture", onEnter);
      video.removeEventListener("leavepictureinpicture", onLeave);
    };
  }, [isReady]);

  async function togglePiP() {
    try {
      if (isPiP) {
        await document.exitPictureInPicture();
      } else {
        const video = videoRef.current as (HTMLVideoElement & { requestPictureInPicture?: () => Promise<unknown> }) | null;
        await video?.requestPictureInPicture?.();
      }
    } catch (err) {
      console.warn("[VideoPlayer] PiP refusé :", err);
    }
  }

  return (
    <div className="border border-[var(--surface-2)] rounded-md bg-surface-1 p-6">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span
            className={`rounded-pill ${
              isReady ? "bg-(--accent-teal)" : isFailed ? "bg-(--danger)" : "bg-(--warn) animate-pulse"
            }`}
            style={{ width: "var(--space-2)", height: "var(--space-2)" }}
            aria-hidden
          />
          <span
            className={`t-13 font-medium ${
              isReady ? "text-(--accent-teal)" : isFailed ? "text-(--danger)" : "text-(--warn)"
            }`}
          >
            {isReady ? "Vidéo prête" : isFailed ? "Échec" : "Génération…"}
          </span>
        </div>
        <div className="flex items-center gap-4 t-11 font-light text-text-faint">
          {meta.provider && <span>Fournisseur · {meta.provider}</span>}
          {meta.duration !== undefined && (
            <span className="font-mono tabular-nums">{formatDuration(meta.duration)}</span>
          )}
          {isReady && pipSupported && (
            <button
              type="button"
              onClick={togglePiP}
              title="Afficher en Picture-in-Picture"
              className={`t-11 transition-colors duration-150 ${
                isPiP ? "text-(--accent-teal)" : "text-(--text-faint) hover:text-(--accent-teal)"
              }`}
            >
              <PiPIcon active={isPiP} />
            </button>
          )}
        </div>
      </header>

      {isReady && variant.storageUrl ? (
        <video
          ref={videoRef}
          controls
          preload="metadata"
          src={variant.storageUrl}
          className="w-full rounded-sm border border-(--border-shell)"
        />
      ) : isFailed ? (
        <p className="t-13 text-(--danger)">{variant.error ?? "Génération échouée"}</p>
      ) : (
        <p className="t-13 font-light text-text-muted">
          Génération en cours via HeyGen/Runway…
        </p>
      )}
    </div>
  );
}
