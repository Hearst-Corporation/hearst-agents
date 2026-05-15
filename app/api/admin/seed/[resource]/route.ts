import { NextResponse } from "next/server";
import { isError, requireAdmin } from "@/app/api/admin/_helpers";
import { runSeed, type SeedResource } from "@/lib/admin/seed";
import { redactedError, withRoute } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";

const log = withRoute("POST /api/admin/seed/[resource]");

const VALID: SeedResource[] = ["agents", "tools", "datasets", "workflows", "skills", "all"];

/* F-124: Rate-limit per-admin + replay detection via idempotency key */
const seedRateLimits = new Map<string, { count: number; resetAt: number }>();
const seedReplays = new Map<string, { result: unknown; at: number }>();

const RATE_LIMIT_PER_ADMIN = 5; // 5 calls per minute
const RATE_LIMIT_WINDOW_MS = 60_000;
const REPLAY_TTL_MS = 3600_000; // 1 hour

function checkRateLimit(adminId: string): boolean {
  const key = adminId;
  const now = Date.now();
  const entry = seedRateLimits.get(key);

  if (!entry || now > entry.resetAt) {
    // Window expiré ou new entry
    seedRateLimits.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_PER_ADMIN) {
    return false; // Exceeded
  }

  entry.count += 1;
  return true;
}

export async function POST(req: Request, context: { params: Promise<{ resource: string }> }) {
  const { resource } = await context.params;
  if (!VALID.includes(resource as SeedResource)) {
    return NextResponse.json({ error: "invalid_resource", allowed: VALID }, { status: 400 });
  }

  const guard = await requireAdmin(`POST /api/admin/seed/${resource}`, {
    resource: "settings",
    action: "update",
  });
  if (isError(guard)) return guard;

  // F-124: Rate-limit per admin + idempotency via X-Idempotency-Key
  const adminId = guard.scope.userId ?? "unknown";
  if (!checkRateLimit(adminId)) {
    log.warn({ adminId, resource }, "seed_rate_limited");
    return NextResponse.json(
      { error: "rate_limited", message: "Max 5 seed calls per minute" },
      { status: 429 },
    );
  }

  // F-124: Replay protection via idempotency key (X-Idempotency-Key header)
  const idempotencyKey = (req.headers as unknown as { get?: (key: string) => string | null }).get?.(
    "x-idempotency-key",
  );
  if (idempotencyKey) {
    const cached = seedReplays.get(idempotencyKey);
    if (cached && Date.now() - cached.at < REPLAY_TTL_MS) {
      log.info({ idempotencyKey }, "seed_replay_detected");
      return NextResponse.json({ ok: true, cached: true, result: cached.result });
    }
  }

  try {
    const reports = await runSeed(guard.db, resource as SeedResource);
    const totals = reports.reduce(
      (acc, r) => ({
        inserted: acc.inserted + r.inserted,
        skipped: acc.skipped + r.skipped,
        errors: acc.errors + r.errors.length,
      }),
      { inserted: 0, skipped: 0, errors: 0 },
    );
    const result = { ok: true, totals, reports };

    // F-124: Cache result for replay protection
    if (idempotencyKey) {
      seedReplays.set(idempotencyKey, { result, at: Date.now() });
      // Cleanup old entries periodically (simple: every 100 calls)
      if (seedReplays.size > 1000) {
        const now = Date.now();
        for (const [key, val] of seedReplays.entries()) {
          if (now - val.at > REPLAY_TTL_MS) seedReplays.delete(key);
        }
      }
    }

    return NextResponse.json(result);
  } catch (e) {
    log.error({ err: redactedError(e), resource, adminId }, "seed_failed");
    return NextResponse.json({ error: "seed_failed" }, { status: 500 });
  }
}
