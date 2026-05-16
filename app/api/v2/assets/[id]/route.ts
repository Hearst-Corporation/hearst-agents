import { NextResponse } from "next/server";
import { evictAssetById, loadAssetById } from "@/lib/assets/types";
import { deleteAssetById } from "@/lib/engine/runtime/assets/adapter";
import { withScope } from "@/lib/platform/http/route-handler";

export const dynamic = "force-dynamic";

export const GET = withScope<{ id: string }>(
  "GET /api/v2/assets/[id]",
  async (_req, { scope, params }) => {
    const { id } = params;
    try {
      const asset = await loadAssetById(id, {
        tenantId: scope.tenantId,
        workspaceId: scope.workspaceId,
      });

      if (!asset) {
        return NextResponse.json({ asset: null }, { status: 404 });
      }

      return NextResponse.json({ asset });
    } catch (e) {
      console.error(`GET /api/v2/assets/${id}: uncaught`, e);
      return NextResponse.json({ error: "internal_error" }, { status: 500 });
    }
  },
);

/**
 * DELETE /api/v2/assets/[id]
 *
 * Hard-deletes the asset row scoped to the caller's tenant/workspace.
 * Storage blob cleanup is left to the cleanup worker (async).
 */
export const DELETE = withScope<{ id: string }>(
  "DELETE /api/v2/assets/[id]",
  async (_req, { scope, params }) => {
    const { id } = params;
    const result = await deleteAssetById(id, {
      tenantId: scope.tenantId,
      workspaceId: scope.workspaceId,
    });

    // Evict du cache V2 in-memory (assetCache dans lib/assets/types.ts).
    evictAssetById(id);

    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? "delete_failed" }, { status: 502 });
    }
    return NextResponse.json({ ok: true, dbDeleted: result.deletedCount });
  },
);
