"use client";

import { useCallback, useState } from "react";
import { type AssetDragPayload, readAssetDragPayload } from "../../use-asset-drag";

interface UseAttachedAssetsParams {
  setInput: React.Dispatch<React.SetStateAction<string>>;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
}

/**
 * Drag-and-drop d'assets vers le composer + state des assets attachés.
 * Le payload `application/x-hearst-asset+json` est lu via `readAssetDragPayload`.
 * Pas d'inlining du contenu : on passe par référence (`assetId`) — invariant I-17.
 */
export function useAttachedAssets({ setInput, inputRef }: UseAttachedAssetsParams) {
  const [attachedAssets, setAttachedAssets] = useState<AssetDragPayload[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleAssetDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragOver(false);
      const payload = readAssetDragPayload(event);
      if (!payload) return;
      setAttachedAssets((prev) => {
        if (prev.some((a) => a.assetId === payload.assetId)) return prev;
        return [...prev, payload];
      });
      const mention = `@asset:${payload.title}`;
      setInput((prev) =>
        prev.endsWith(" ") || prev.length === 0 ? `${prev + mention} ` : `${prev} ${mention} `,
      );
      inputRef.current?.focus();
    },
    [setInput, inputRef],
  );

  const handleAssetDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (event.dataTransfer.types.includes("application/x-hearst-asset+json")) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      setIsDragOver(true);
    }
  }, []);

  const handleAssetDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const removeAttachedAsset = useCallback((assetId: string) => {
    setAttachedAssets((prev) => prev.filter((a) => a.assetId !== assetId));
  }, []);

  const resetAttachedAssets = useCallback(() => {
    setAttachedAssets([]);
  }, []);

  return {
    attachedAssets,
    isDragOver,
    handleAssetDrop,
    handleAssetDragOver,
    handleAssetDragLeave,
    removeAttachedAsset,
    resetAttachedAssets,
  };
}
