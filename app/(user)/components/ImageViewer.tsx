"use client";

import { Chip } from "@/app/(user)/components/ui/Chip";
import type { AssetVariant } from "@/lib/assets/variants";

interface ImageViewerProps {
  variant: AssetVariant;
}

export function ImageViewer({ variant }: ImageViewerProps) {
  const isReady = variant.status === "ready" && !!variant.storageUrl;
  const isFailed = variant.status === "failed";
  const meta = (variant.metadata ?? {}) as { model?: string; width?: number; height?: number };

  return (
    <div className="border border-[var(--surface-2)] rounded-md bg-surface-1 p-6">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Chip
            variant="dot"
            className={
              isReady
                ? "bg-(--accent-teal)"
                : isFailed
                  ? "bg-(--danger)"
                  : "bg-(--warn) animate-pulse"
            }
            aria-hidden
          />
          <span
            className={`t-13 font-medium ${
              isReady ? "text-(--accent-teal)" : isFailed ? "text-(--danger)" : "text-(--warn)"
            }`}
          >
            {isReady ? "Image prête" : isFailed ? "Échec" : "Génération…"}
          </span>
        </div>
        <div className="flex items-center gap-4 t-11 font-light text-text-faint">
          {meta.model && <span>Modèle · {meta.model}</span>}
          {meta.width && meta.height && (
            <span className="font-mono tabular-nums">
              {meta.width}×{meta.height}
            </span>
          )}
        </div>
      </header>

      {isReady && variant.storageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={variant.storageUrl}
          alt={variant.id}
          className="w-full rounded-sm border border-(--border-shell)"
          style={{ maxHeight: "var(--space-96)" }}
        />
      ) : isFailed ? (
        <p className="t-13 text-(--danger)">{variant.error ?? "Génération échouée"}</p>
      ) : (
        <p className="t-13 font-light text-text-muted">Génération en cours via fal.ai…</p>
      )}
    </div>
  );
}
