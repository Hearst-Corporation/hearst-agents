/**
 * GET  /api/v2/marketplace/templates  — liste paginée des templates publics
 * POST /api/v2/marketplace/templates  — publie un nouveau template
 *
 * Filtres query params (GET) :
 *   kind={workflow|report_spec|persona}
 *   tags=tag1,tag2 (intersection)
 *   featured=1
 *   q=search (title + description ilike)
 *   limit=30 offset=0
 *
 * Body POST :
 *   { kind, title, description?, payload, tags?, anonymizeAuthor? }
 */

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/marketplace/rate-limit";
import { listTemplates, publishTemplate } from "@/lib/marketplace/store";
import { MARKETPLACE_KINDS, tagsSchema } from "@/lib/marketplace/types";
import { requireScope } from "@/lib/platform/auth/scope";
import { parseJsonBody } from "@/lib/platform/http/parse-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── GET ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { scope: _scope, error } = await requireScope({
    context: "GET /api/v2/marketplace/templates",
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  const { searchParams } = new URL(req.url);
  const kindParam = searchParams.get("kind");
  const kind =
    kindParam && (MARKETPLACE_KINDS as readonly string[]).includes(kindParam)
      ? (kindParam as (typeof MARKETPLACE_KINDS)[number])
      : undefined;
  const tagsParam = searchParams.get("tags");
  const tags = tagsParam
    ? tagsParam
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 5)
    : undefined;
  const featured = searchParams.get("featured") === "1";
  const q = searchParams.get("q") ?? undefined;
  const limit = Number.parseInt(searchParams.get("limit") ?? "30", 10) || 30;
  const offset = Number.parseInt(searchParams.get("offset") ?? "0", 10) || 0;

  const templates = await listTemplates({
    kind,
    tags,
    featured,
    q,
    limit,
    offset,
  });

  return NextResponse.json({
    templates,
  });
}

// ── POST ────────────────────────────────────────────────────

const publishSchema = z.object({
  kind: z.enum(MARKETPLACE_KINDS),
  title: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  payload: z.unknown(),
  tags: tagsSchema.optional(),
  anonymizeAuthor: z.boolean().optional(),
  authorDisplayName: z.string().max(80).optional(),
});

export async function POST(req: NextRequest) {
  const { scope, error } = await requireScope({
    context: "POST /api/v2/marketplace/templates",
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (!checkRateLimit(scope.userId, "publish")) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const parsed = await parseJsonBody(req, publishSchema);
  if (!parsed.ok) return parsed.response;

  const display = parsed.data.anonymizeAuthor
    ? null
    : parsed.data.authorDisplayName?.trim() || null;

  const template = await publishTemplate({
    kind: parsed.data.kind,
    title: parsed.data.title,
    description: parsed.data.description,
    payload: parsed.data.payload,
    tags: parsed.data.tags,
    authorUserId: scope.userId,
    authorTenantId: scope.tenantId,
    authorDisplayName: display ?? undefined,
  });

  if (!template) {
    return NextResponse.json({ error: "publish_failed" }, { status: 500 });
  }

  return NextResponse.json({ template }, { status: 201 });
}
