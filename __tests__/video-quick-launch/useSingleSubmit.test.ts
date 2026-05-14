import { describe, it, expect, vi, beforeEach } from "vitest";

// Court-circuite useCallback pour pouvoir appeler le hook hors React et
// récupérer la fonction de submit telle quelle.
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useCallback: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
  };
});

import { useSingleSubmit } from "@/app/(user)/components/video-quick-launch/hooks/useSingleSubmit";
import type { UseVideoSSEResult } from "@/app/(user)/components/video-quick-launch/hooks/useVideoSSE";
import type { SinglePhase } from "@/app/(user)/components/video-quick-launch/types";

function makeSingle(phase: SinglePhase = "idle"): UseVideoSSEResult {
  return {
    phase,
    setPhase: vi.fn(),
    progress: 0,
    setProgress: vi.fn(),
    errorMsg: null,
    setErrorMsg: vi.fn(),
    subscribe: vi.fn(),
    reset: vi.fn(),
    close: vi.fn(),
  };
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

describe("useSingleSubmit", () => {
  it("ne fait rien quand le prompt est vide", async () => {
    const single = makeSingle("idle");
    const submit = useSingleSubmit({
      prompt: "   ",
      provider: "runway",
      duration: 5,
      ratio: "1280:720",
      single,
      onAssetCreated: vi.fn(),
    });
    await submit();
    expect(single.setPhase).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("ne fait rien quand single.phase est 'running'", async () => {
    const single = makeSingle("running");
    const submit = useSingleSubmit({
      prompt: "Un beau prompt",
      provider: "runway",
      duration: 5,
      ratio: "1280:720",
      single,
      onAssetCreated: vi.fn(),
    });
    await submit();
    expect(single.setPhase).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("enchaîne creating → queued → subscribe en cas de succès complet", async () => {
    const single = makeSingle("idle");
    const onAssetCreated = vi.fn();

    (fetch as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ asset: { id: "a1" } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jobId: "j1" }),
      });

    const submit = useSingleSubmit({
      prompt: "Génère ma vidéo",
      provider: "runway",
      duration: 5,
      ratio: "1280:720",
      single,
      onAssetCreated,
    });

    await submit();

    expect(single.setPhase).toHaveBeenCalledWith("creating");
    expect(single.setPhase).toHaveBeenCalledWith("queued");
    expect(onAssetCreated).toHaveBeenCalledWith("a1");
    expect(single.subscribe).toHaveBeenCalledWith("j1", "runway");
    expect(single.setPhase).not.toHaveBeenCalledWith("error");
  });

  it("bascule en error si fetch renvoie ok:false", async () => {
    const single = makeSingle("idle");

    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Quota dépassé" }),
    });

    const submit = useSingleSubmit({
      prompt: "Génère ma vidéo",
      provider: "runway",
      duration: 5,
      ratio: "1280:720",
      single,
      onAssetCreated: vi.fn(),
    });

    await submit();

    expect(single.setPhase).toHaveBeenCalledWith("error");
    expect(single.setErrorMsg).toHaveBeenCalledWith("Quota dépassé");
    expect(single.subscribe).not.toHaveBeenCalled();
  });

  it("bascule en error si fetch throw", async () => {
    const single = makeSingle("idle");

    (fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Network down"),
    );

    const submit = useSingleSubmit({
      prompt: "Génère ma vidéo",
      provider: "runway",
      duration: 5,
      ratio: "1280:720",
      single,
      onAssetCreated: vi.fn(),
    });

    await submit();

    expect(single.setPhase).toHaveBeenCalledWith("error");
    expect(single.setErrorMsg).toHaveBeenCalledWith("Network down");
    expect(single.subscribe).not.toHaveBeenCalled();
  });
});
