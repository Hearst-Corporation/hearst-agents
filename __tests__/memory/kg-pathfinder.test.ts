/**
 * findPath — BFS itératif borné (B11.3 / F-120).
 *
 * Mock du client Supabase au niveau requireServerSupabase pour fournir
 * un graphe stable ; on vérifie :
 *  - chemin direct (1 hop)
 *  - chemin transitif (2 hops)
 *  - cap `maxHops` (chemin > cap → null)
 *  - paire non connectée → null
 *  - LRU cache (deuxième appel ne retape pas la base)
 *
 * Note : on ne peut pas `vi.mock("@/lib/memory/kg", ...)` pour remplacer
 * `getGraph`, car `findPath` appelle `getGraph` via une référence
 * intra-module (pas via l'export), donc le mock ne s'applique pas. On
 * mock un niveau plus bas (Supabase) — comportement réel de la chaîne
 * findPath → getGraph → supabase.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

interface MockRow {
  id: string;
  user_id: string;
  tenant_id: string;
  [key: string]: unknown;
}

const mockState: { nodes: MockRow[]; edges: MockRow[]; calls: number } = {
  nodes: [],
  edges: [],
  calls: 0,
};

vi.mock("@/lib/platform/db/supabase", () => ({
  requireServerSupabase: () => ({
    from: (table: string) => {
      const rows = table === "kg_nodes" ? mockState.nodes : mockState.edges;
      // builder minimaliste : on track le filtrage user_id/tenant_id pour
      // simuler la sémantique réelle. Pas d'ilike/in/eq(id) ici car
      // findPath n'utilise que .eq(user_id).eq(tenant_id).
      const builder = {
        _filters: {} as Record<string, unknown>,
        _pendingTenantResolve: false as boolean,
        select() {
          return this;
        },
        eq(col: string, val: unknown) {
          this._filters[col] = val;
          if (col === "tenant_id") {
            // Marque que le prochain .limit() doit résoudre la query.
            this._pendingTenantResolve = true;
            return this;
          }
          if (col === "id") {
            // findPath case fromId === toId → getNode → .eq(id).maybeSingle
            const target = rows.find(
              (r) =>
                r.id === val &&
                r.user_id === this._filters.user_id &&
                r.tenant_id === this._filters.tenant_id,
            );
            return {
              maybeSingle: () => Promise.resolve({ data: target ?? null, error: null }),
            };
          }
          return this;
        },
        limit(_n: number) {
          if (this._pendingTenantResolve) {
            mockState.calls++;
            const filtered = rows.filter(
              (r) => r.user_id === this._filters.user_id && r.tenant_id === this._filters.tenant_id,
            );
            return Promise.resolve({ data: filtered, error: null });
          }
          return this;
        },
      };
      return builder;
    },
  }),
}));

import { _resetKgCacheForTests, findPath, type KgEdge, type KgNode } from "@/lib/memory/kg";

function node(id: string, label: string): KgNode {
  return {
    id,
    user_id: "u1",
    tenant_id: "t1",
    type: "person",
    label,
    properties: {},
    created_at: "2026-05-01T10:00:00Z",
    updated_at: "2026-05-01T10:00:00Z",
  };
}

function edge(id: string, source: string, target: string): KgEdge {
  return {
    id,
    user_id: "u1",
    tenant_id: "t1",
    source_id: source,
    target_id: target,
    type: "related_to",
    weight: 1.0,
    created_at: "2026-05-01T10:00:00Z",
  };
}

const SCOPE = { userId: "u1", tenantId: "t1" } as const;

function setGraph(nodes: KgNode[], edges: KgEdge[]) {
  mockState.nodes = nodes as unknown as MockRow[];
  mockState.edges = edges as unknown as MockRow[];
  mockState.calls = 0;
}

describe("findPath (BFS)", () => {
  beforeEach(() => {
    _resetKgCacheForTests();
    mockState.nodes = [];
    mockState.edges = [];
    mockState.calls = 0;
  });

  it("trouve un chemin direct en 1 hop", async () => {
    setGraph([node("a", "A"), node("b", "B")], [edge("e1", "a", "b")]);
    const result = await findPath(SCOPE, "a", "b");
    expect(result).not.toBeNull();
    expect(result?.hops).toBe(1);
    expect(result?.nodes.map((n) => n.id)).toEqual(["a", "b"]);
    expect(result?.edges.map((e) => e.id)).toEqual(["e1"]);
  });

  it("trouve un chemin transitif en 2 hops via un intermédiaire", async () => {
    setGraph(
      [node("a", "A"), node("b", "B"), node("c", "C")],
      [edge("e1", "a", "b"), edge("e2", "b", "c")],
    );
    const result = await findPath(SCOPE, "a", "c");
    expect(result).not.toBeNull();
    expect(result?.hops).toBe(2);
    expect(result?.nodes.map((n) => n.id)).toEqual(["a", "b", "c"]);
  });

  it("respecte maxHops (chemin > cap → null)", async () => {
    setGraph(
      [node("a", "A"), node("b", "B"), node("c", "C"), node("d", "D")],
      [edge("e1", "a", "b"), edge("e2", "b", "c"), edge("e3", "c", "d")],
    );
    const result = await findPath(SCOPE, "a", "d", 2);
    expect(result).toBeNull();
  });

  it("retourne null si les nodes ne sont pas connectés", async () => {
    setGraph([node("a", "A"), node("b", "B"), node("c", "C")], [edge("e1", "a", "b")]);
    const result = await findPath(SCOPE, "a", "c");
    expect(result).toBeNull();
  });

  it("cache LRU : deuxième appel ne refait pas le fetch", async () => {
    setGraph([node("a", "A"), node("b", "B")], [edge("e1", "a", "b")]);
    await findPath(SCOPE, "a", "b");
    const callsAfterFirst = mockState.calls;
    await findPath(SCOPE, "a", "b");
    expect(mockState.calls).toBe(callsAfterFirst);
  });
});
