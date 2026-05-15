/**
 * @vitest-environment jsdom
 *
 * useOfflineStatus — listen online/offline events.
 */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useOfflineStatus } from "@/app/(user)/components/use-offline-status";

describe("useOfflineStatus", () => {
  it("retourne isOnline=true par défaut quand navigator.onLine=true", () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      get: () => true,
    });
    const { result } = renderHook(() => useOfflineStatus());
    expect(result.current.isOnline).toBe(true);
  });

  it("bascule en offline sur event 'offline'", () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      get: () => true,
    });
    const { result } = renderHook(() => useOfflineStatus());
    expect(result.current.isOnline).toBe(true);

    act(() => {
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        get: () => false,
      });
      window.dispatchEvent(new Event("offline"));
    });
    expect(result.current.isOnline).toBe(false);
  });

  it("re-bascule en online sur event 'online'", () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      get: () => false,
    });
    const { result } = renderHook(() => useOfflineStatus());
    expect(result.current.isOnline).toBe(false);

    act(() => {
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        get: () => true,
      });
      window.dispatchEvent(new Event("online"));
    });
    expect(result.current.isOnline).toBe(true);
  });
});
