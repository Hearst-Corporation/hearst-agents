/**
 * Context Navigate — tests unitaires
 *
 * Couvre :
 *   1. SSEAdapter.toSSE sérialise correctement `context_navigate`.
 *   2. Le schema `page_context` accepte currentContext + availableContexts
 *      et reste OK sans eux (additif/non-breaking).
 *   3. La fonction pure `pickNavigateContext` — table de mapping domaine→contexte,
 *      exclusions (domaine non mappé, cible absente, cible === currentContext).
 */

import { describe, expect, it } from "vitest";
import { orchestrateBodySchema } from "@/app/api/orchestrate/route";
import { pickNavigateContext } from "@/lib/engine/orchestrator";

// ── 1. Schema page_context — nouveaux champs optionnels ───────────────────────

describe("orchestrateBodySchema — context-navigate fields (additifs, non-breaking)", () => {
  it("accepte un payload sans page_context (rétrocompat)", () => {
    expect(orchestrateBodySchema.safeParse({ message: "hi" }).success).toBe(true);
  });

  it("accepte page_context sans currentContext ni availableContexts", () => {
    expect(
      orchestrateBodySchema.safeParse({
        message: "hi",
        page_context: { page: "home" },
      }).success,
    ).toBe(true);
  });

  it("accepte currentContext seul", () => {
    const r = orchestrateBodySchema.safeParse({
      message: "hi",
      page_context: { currentContext: "inbox" },
    });
    expect(r.success).toBe(true);
    expect(r.success && r.data.page_context?.currentContext).toBe("inbox");
  });

  it("accepte availableContexts seul", () => {
    const r = orchestrateBodySchema.safeParse({
      message: "hi",
      page_context: { availableContexts: ["inbox", "documents", "missions"] },
    });
    expect(r.success).toBe(true);
    expect(r.success && r.data.page_context?.availableContexts).toEqual([
      "inbox",
      "documents",
      "missions",
    ]);
  });

  it("accepte currentContext + availableContexts ensemble", () => {
    const r = orchestrateBodySchema.safeParse({
      message: "hi",
      page_context: {
        currentContext: "missions",
        availableContexts: ["inbox", "documents", "missions"],
      },
    });
    expect(r.success).toBe(true);
  });

  it("rejette availableContexts avec plus de 50 entrées", () => {
    const r = orchestrateBodySchema.safeParse({
      message: "hi",
      page_context: {
        availableContexts: Array.from({ length: 51 }, (_, i) => `ctx-${i}`),
      },
    });
    expect(r.success).toBe(false);
  });

  it("n'affecte pas les champs page_context existants (rétrocompat)", () => {
    const r = orchestrateBodySchema.safeParse({
      message: "hi",
      page_context: {
        page: "assets",
        activeView: "visual",
        mode: "browse",
        selectedItem: { type: "asset", id: "abc-123" },
        currentContext: "media",
        availableContexts: ["media", "documents"],
      },
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.page_context?.page).toBe("assets");
      expect(r.data.page_context?.currentContext).toBe("media");
      expect(r.data.page_context?.availableContexts).toEqual(["media", "documents"]);
    }
  });
});

// ── 2. SSEAdapter.toSSE — sérialisation context_navigate ──────────────────────

describe("SSEAdapter — sérialise context_navigate (passe-plat)", () => {
  // On teste toSSE indirectement : l'adapter est privé, on l'instancie via le bus.
  // Mais toSSE est aussi testable en exportant le résultat via handleEvent + spy.
  // Approche légère : on crée un adapter, on émet l'event, on intercepte le chunk SSE.

  it("émet {type:'context_navigate', contextId} sur le stream SSE", async () => {
    const { RunEventBus } = await import("@/lib/events/bus");
    const { SSEAdapter } = await import("@/lib/events/consumers/sse-adapter");

    const bus = new RunEventBus();
    const adapter = new SSEAdapter(bus);

    const chunks: string[] = [];
    const stream = new ReadableStream({
      start(controller) {
        adapter.pipe(controller);
      },
    });
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    bus.emit({
      type: "context_navigate",
      run_id: "run-test-123",
      contextId: "inbox",
    });

    // Lit le premier chunk disponible (synchrone via microtask)
    const { value } = await reader.read();
    if (value) chunks.push(decoder.decode(value));

    reader.cancel();
    adapter.close();
    bus.destroy();

    expect(chunks.length).toBeGreaterThan(0);
    const payload = JSON.parse(chunks[0].replace(/^data: /, "").trim());
    expect(payload.type).toBe("context_navigate");
    expect(payload.contextId).toBe("inbox");
  });
});

// ── 3. pickNavigateContext — fonction pure ────────────────────────────────────

describe("pickNavigateContext — table de mapping domaine→contexte", () => {
  // Mappings attendus (DOMAIN_TO_CONTEXT)
  const AVAILABLE = ["inbox", "documents", "media", "reports", "missions", "home"];

  it("communication → inbox", () => {
    expect(pickNavigateContext("communication", AVAILABLE)).toBe("inbox");
  });

  it("documents → documents", () => {
    expect(pickNavigateContext("documents", AVAILABLE)).toBe("documents");
  });

  it("media → media", () => {
    expect(pickNavigateContext("media", AVAILABLE)).toBe("media");
  });

  it("research → reports", () => {
    expect(pickNavigateContext("research", AVAILABLE)).toBe("reports");
  });

  it("productivity → missions", () => {
    expect(pickNavigateContext("productivity", AVAILABLE)).toBe("missions");
  });

  // Domaines non mappés → null (conservateur)
  it("general → null (domaine non mappé)", () => {
    expect(pickNavigateContext("general", AVAILABLE)).toBeNull();
  });

  it("finance → null (domaine non mappé)", () => {
    expect(pickNavigateContext("finance", AVAILABLE)).toBeNull();
  });

  it("crm → null (domaine non mappé)", () => {
    expect(pickNavigateContext("crm", AVAILABLE)).toBeNull();
  });

  it("design → null (domaine non mappé)", () => {
    expect(pickNavigateContext("design", AVAILABLE)).toBeNull();
  });

  it("developer → null (domaine non mappé)", () => {
    expect(pickNavigateContext("developer", AVAILABLE)).toBeNull();
  });

  it("analysis → null (domaine non mappé)", () => {
    expect(pickNavigateContext("analysis", AVAILABLE)).toBeNull();
  });

  // Cible absente de availableContexts → null
  it("communication → null si 'inbox' absent de availableContexts", () => {
    const withoutInbox = AVAILABLE.filter((c) => c !== "inbox");
    expect(pickNavigateContext("communication", withoutInbox)).toBeNull();
  });

  it("availableContexts vide → null", () => {
    expect(pickNavigateContext("communication", [])).toBeNull();
  });

  // Cible === currentContext → null (pas de navigate no-op)
  it("communication → null si currentContext === 'inbox' (déjà là)", () => {
    expect(pickNavigateContext("communication", AVAILABLE, "inbox")).toBeNull();
  });

  it("communication → 'inbox' si currentContext est différent", () => {
    expect(pickNavigateContext("communication", AVAILABLE, "home")).toBe("inbox");
  });

  it("currentContext undefined → pas de filtre actif", () => {
    expect(pickNavigateContext("communication", AVAILABLE, undefined)).toBe("inbox");
  });
});
