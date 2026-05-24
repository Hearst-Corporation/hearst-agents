import { NextResponse } from "next/server";
import {
  getArchitectureGraph,
  getDownstreamDependencies,
  getReverseDependencies,
} from "@/lib/architecture-map/graph";
import { invalidateCache, loadArchitectureMap } from "@/lib/architecture-map/load";
import { requireScope } from "@/lib/platform/auth/scope";
import { safeErrorResponse } from "@/lib/platform/errors/safe-response";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error: authError } = await requireScope({ context: "GET /api/v2/architecture" });
  if (authError)
    return NextResponse.json({ error: authError.message }, { status: authError.status });

  try {
    invalidateCache();
    const map = loadArchitectureMap();
    const { nodes, edges } = getArchitectureGraph(map);

    const nodesWithImpact = nodes.map((n) => ({
      ...n,
      upstream: getReverseDependencies(n.id, map),
      downstream: getDownstreamDependencies(n.id, map),
    }));

    return NextResponse.json({
      meta: map.meta,
      nodes: nodesWithImpact,
      edges,
      flows: map.flows,
      agents: map.agents,
      raw: map,
    });
  } catch (e) {
    return safeErrorResponse(e, { route: "GET /api/v2/architecture" });
  }
}
