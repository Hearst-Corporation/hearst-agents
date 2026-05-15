/**
 * @vitest-environment jsdom
 *
 * readAssetDragPayload — vérifie le round-trip du payload via dataTransfer.
 */

import { describe, expect, it, vi } from "vitest";
import { ASSET_DRAG_MIME, readAssetDragPayload } from "@/app/(user)/components/use-asset-drag";

function makeDataTransfer() {
  const store = new Map<string, string>();
  return {
    setData: vi.fn((mime: string, value: string) => {
      store.set(mime, value);
    }),
    getData: vi.fn((mime: string) => store.get(mime) ?? ""),
    types: [] as string[],
    effectAllowed: "" as string,
    _store: store,
  };
}

describe("readAssetDragPayload", () => {
  it("retourne le payload roundtrip", () => {
    const dt = makeDataTransfer();
    dt.setData(ASSET_DRAG_MIME, JSON.stringify({ assetId: "a1", kind: "report", title: "T" }));
    const payload = readAssetDragPayload({
      dataTransfer: dt,
    } as unknown as React.DragEvent<HTMLElement>);
    expect(payload).toEqual({ assetId: "a1", kind: "report", title: "T" });
  });

  it("retourne null si le MIME absent", () => {
    const dt = makeDataTransfer();
    const payload = readAssetDragPayload({
      dataTransfer: dt,
    } as unknown as React.DragEvent<HTMLElement>);
    expect(payload).toBeNull();
  });

  it("retourne null sur JSON invalide", () => {
    const dt = makeDataTransfer();
    dt.setData(ASSET_DRAG_MIME, "{not-json");
    const payload = readAssetDragPayload({
      dataTransfer: dt,
    } as unknown as React.DragEvent<HTMLElement>);
    expect(payload).toBeNull();
  });
});
