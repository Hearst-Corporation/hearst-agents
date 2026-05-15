import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useCallback: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
  };
});

import { useBatchSubmit } from "@/app/(user)/components/video-quick-launch/hooks/useBatchSubmit";
import type { UseVideoBatchSSEResult } from "@/app/(user)/components/video-quick-launch/hooks/useVideoBatchSSE";
import type {
  BatchPhase,
  BatchVariantForm,
} from "@/app/(user)/components/video-quick-launch/types";

function makeBatch(phase: BatchPhase = "idle"): UseVideoBatchSSEResult {
  return {
    phase,
    setPhase: vi.fn(),
    runs: [],
    setRuns: vi.fn(),
    assetId: null,
    setAssetId: vi.fn(),
    errorMsg: null,
    setErrorMsg: vi.fn(),
    initRuns: vi.fn(),
    subscribe: vi.fn(),
    reset: vi.fn(),
    close: vi.fn(),
  };
}

function makeForm(prompt: string, localId = "loc-1"): BatchVariantForm {
  return {
    localId,
    prompt,
    provider: "runway",
    duration: 5,
    ratio: "1280:720",
  };
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

describe("useBatchSubmit", () => {
  it("ne fait rien si aucun form n'a de prompt valide", async () => {
    const batch = makeBatch("idle");
    const submit = useBatchSubmit({
      batchForms: [makeForm(""), makeForm("   ")],
      batch,
    });
    await submit();
    expect(batch.setPhase).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("ne fait rien quand batch.phase est 'running'", async () => {
    const batch = makeBatch("running");
    const submit = useBatchSubmit({
      batchForms: [makeForm("ok")],
      batch,
    });
    await submit();
    expect(batch.setPhase).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("setAssetId + initRuns + subscribe + running en cas de succès", async () => {
    const batch = makeBatch("idle");

    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        assetId: "a1",
        jobs: [{ jobId: "j1", index: 0, variantId: "v1", kind: "video" }],
      }),
    });

    const form = makeForm("Premier prompt");
    const submit = useBatchSubmit({ batchForms: [form], batch });
    await submit();

    expect(batch.setPhase).toHaveBeenCalledWith("creating");
    expect(batch.setAssetId).toHaveBeenCalledWith("a1");
    expect(batch.initRuns).toHaveBeenCalledWith(
      [form],
      [{ jobId: "j1", index: 0, variantId: "v1", kind: "video" }],
    );
    expect(batch.subscribe).toHaveBeenCalledWith("j1", 0);
    expect(batch.setPhase).toHaveBeenCalledWith("running");
    expect(batch.setPhase).not.toHaveBeenCalledWith("error");
  });

  it("bascule en error si jobs est vide dans la réponse", async () => {
    const batch = makeBatch("idle");

    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ assetId: "a1", jobs: [] }),
    });

    const submit = useBatchSubmit({
      batchForms: [makeForm("Prompt OK")],
      batch,
    });
    await submit();

    expect(batch.setPhase).toHaveBeenCalledWith("error");
    expect(batch.setErrorMsg).toHaveBeenCalledWith("Aucun variant n'a pu être enqueué");
    expect(batch.subscribe).not.toHaveBeenCalled();
  });

  it("bascule en error sur erreur HTTP", async () => {
    const batch = makeBatch("idle");

    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Forbidden" }),
    });

    const submit = useBatchSubmit({
      batchForms: [makeForm("Prompt OK")],
      batch,
    });
    await submit();

    expect(batch.setPhase).toHaveBeenCalledWith("error");
    expect(batch.setErrorMsg).toHaveBeenCalledWith("Forbidden");
    expect(batch.subscribe).not.toHaveBeenCalled();
    expect(batch.initRuns).not.toHaveBeenCalled();
  });
});
