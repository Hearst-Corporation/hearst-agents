export const ASSET_DRAG_MIME = "application/x-hearst-asset+json";

export interface AssetDragPayload {
  assetId: string;
  kind: string;
  title: string;
}

/**
 * Extrait le payload d'un drop event si présent.
 * Retourne `null` si le drop ne porte pas notre MIME type ou si le JSON est invalide.
 */
export function readAssetDragPayload(event: React.DragEvent<HTMLElement>): AssetDragPayload | null {
  try {
    const raw = event.dataTransfer.getData(ASSET_DRAG_MIME);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AssetDragPayload>;
    if (
      typeof parsed?.assetId === "string" &&
      typeof parsed?.kind === "string" &&
      typeof parsed?.title === "string"
    ) {
      return parsed as AssetDragPayload;
    }
    return null;
  } catch {
    return null;
  }
}
