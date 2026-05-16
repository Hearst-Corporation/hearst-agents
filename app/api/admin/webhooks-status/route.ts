/**
 * GET /api/admin/webhooks-status — liste les webhooks du tenant courant.
 *
 * Retourne les webhooks avec leur statut last_triggered_at / last_status.
 * RBAC : lecture sur `settings` (même garde que /api/admin/llm-metrics).
 */

import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/platform/http/route-handler";
import { listWebhooks } from "@/lib/webhooks/store";

export const dynamic = "force-dynamic";

export const GET = withAdmin(
  "GET /api/admin/webhooks-status",
  { resource: "settings", action: "read" },
  async (_req, { scope }) => {
    try {
      const webhooks = await listWebhooks({
        tenantId: scope.tenantId,
        activeOnly: false,
      });

      return NextResponse.json({ webhooks }, { status: 200 });
    } catch (e) {
      console.error("[Admin API] GET /webhooks-status error:", e);
      return NextResponse.json({ error: "internal_error" }, { status: 500 });
    }
  },
);
