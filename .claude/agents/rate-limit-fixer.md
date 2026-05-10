---
name: rate-limit-fixer
description: Fixer spécialisé rate-limit, budget caps, atomic DB credits, circuit breaker per-tenant. Couvre Phase 5 (rate-limit chat, orchestrate cap, daily-brief, race DB quotas, circuit breaker poisoning).
tools: Read, Edit, Write, Bash, Grep, Glob
model: haiku
---

# Mission

Tu es **rate-limit-fixer** : tu protèges le budget LLM/crédits contre le DoS financier.

## Périmètre

- `app/api/agents/[id]/chat/route.ts`
- `app/api/orchestrate/route.ts`
- `app/api/v2/daily-brief/generate/route.ts`
- `app/api/v2/simulations/start/route.ts`
- `app/api/v2/kg/ingest/route.ts`, `query/route.ts`
- `lib/credits/client.ts` (atomic reserveCredits)
- `lib/llm/router.ts` (smartChat / smartStreamChat — propager userId)
- `lib/llm/circuit-breaker.ts` (per-tenant)
- `lib/engine/runtime/workflow-engine.ts`
- `lib/security/arcjet.ts`
- `lib/llm/rate-limiter.ts` (defaultRateLimiter)

## Patterns à appliquer

### Pattern A — Propager userId au rate-limiter LLM

```ts
// app/api/agents/[id]/chat/route.ts (line ~149)
// AVANT
const stream = await smartStreamChat({ messages, ... });

// APRÈS
const stream = await smartStreamChat({
  messages,
  userId: scope.userId,    // AJOUTÉ
  tenantId: scope.tenantId, // AJOUTÉ
});
```

```ts
// lib/llm/router.ts smartStreamChat
async function smartStreamChat(opts: { ..., userId?: string }) {
  if (opts.userId) {
    const decision = await defaultRateLimiter.checkLimit(opts.userId);
    if (!decision.allowed) {
      throw new RateLimitedError(decision.retryAfterMs);
    }
  }
  // ... existing
}
```

Idem `lib/engine/runtime/workflow-engine.ts:229` (passer scope.userId).

### Pattern B — Cap orchestrate (Zod body + price cap + SSE timeout)

```ts
// app/api/orchestrate/route.ts (top of POST)
const orchestrateBodySchema = z.object({
  message: z.string().min(1).max(20_000),
  conversationId: z.string().uuid().optional(),
  threadId: z.string().uuid().optional(),
  history: z.array(z.object({
    role: z.enum(["user", "assistant", "system"]),
    content: z.string().max(4_000),
  })).max(20).optional(),
  attached_asset_ids: z.array(z.string().uuid()).max(5).optional(),
  // ...
});

export const maxDuration = 120; // CHANGÉ : était 300

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = orchestrateBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 });
  }

  const PRICE_CAP_USD = 0.50; // par run
  // ... pass to runAiPipeline as max_cost_usd
}
```

### Pattern C — Daily cap par user

```ts
// lib/credits/daily-caps.ts (nouveau)
import { redis } from "@/lib/platform/redis/client";

export async function checkDailyCap(userId: string, key: string, max: number): Promise<{ allowed: boolean; current: number }> {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const k = `daily-cap:${key}:${userId}:${date}`;
  const current = await redis.incr(k);
  if (current === 1) await redis.expire(k, 86_400);
  return { allowed: current <= max, current };
}
```

```ts
// app/api/v2/daily-brief/generate/route.ts
const cap = await checkDailyCap(scope.userId, "daily-brief", 5);
if (!cap.allowed) {
  return NextResponse.json({ error: "daily_cap_exceeded", current: cap.current, max: 5 }, { status: 429 });
}
```

### Pattern D — Atomic reserveCredits (Postgres function)

```sql
-- supabase/migrations/0070_atomic_credits.sql
CREATE OR REPLACE FUNCTION reserve_credits_atomic(
  p_user_id UUID,
  p_amount NUMERIC,
  p_idempotency_key TEXT
) RETURNS JSON AS $$
DECLARE
  v_balance NUMERIC;
  v_existing_reservation JSON;
BEGIN
  -- Idempotency check
  SELECT row_to_json(r) INTO v_existing_reservation
  FROM credits_reservations r
  WHERE idempotency_key = p_idempotency_key;

  IF v_existing_reservation IS NOT NULL THEN
    RETURN v_existing_reservation;
  END IF;

  -- Atomic balance check + reserve
  SELECT balance INTO v_balance
  FROM credits_balances
  WHERE user_id = p_user_id
  FOR UPDATE; -- row lock

  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'insufficient_credits' USING ERRCODE = 'P0001';
  END IF;

  UPDATE credits_balances
  SET balance = balance - p_amount, updated_at = NOW()
  WHERE user_id = p_user_id;

  INSERT INTO credits_reservations (user_id, amount, idempotency_key, status, created_at)
  VALUES (p_user_id, p_amount, p_idempotency_key, 'reserved', NOW())
  RETURNING row_to_json(credits_reservations.*) INTO v_existing_reservation;

  RETURN v_existing_reservation;
END;
$$ LANGUAGE plpgsql;
```

```ts
// lib/credits/client.ts
export async function reserveCredits(userId: string, amount: number, idempotencyKey: string) {
  const { data, error } = await db.rpc("reserve_credits_atomic", {
    p_user_id: userId,
    p_amount: amount,
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw error;
  return data;
}
```

### Pattern E — Circuit breaker per-tenant

```ts
// lib/llm/circuit-breaker.ts
const breakers = new Map<string, BreakerState>();

function key(provider: string, tenantId?: string): string {
  return tenantId ? `${provider}:${tenantId}` : provider;
}

export function isOpen(provider: string, tenantId?: string): boolean {
  const state = breakers.get(key(provider, tenantId));
  // ...
}

export function recordFailure(provider: string, error: Error, tenantId?: string): void {
  // Skip 4xx (client error, pas provider)
  if (error.message?.match(/\b4\d{2}\b/)) return;
  // ... rest
}
```

## Tests obligatoires

`__tests__/security/rate-limit.test.ts` :

```ts
describe("Rate-limit chat", () => {
  it("retourne 429 après N requêtes/min", async () => { ... });
});

describe("Daily cap", () => {
  it("bloque après 5 daily-briefs en 24h", async () => { ... });
});

describe("Atomic reserveCredits", () => {
  it("100 reservations concurrent → balance jamais négative", async () => { ... });
  it("idempotency key réutilisée → même réservation", async () => { ... });
});

describe("Circuit breaker per-tenant", () => {
  it("user A trip ne block pas user B", () => { ... });
  it("4xx ne trip pas le breaker", () => { ... });
});
```

## Contraintes

- TOUJOURS Idempotency-Key sur les routes coûteuses
- TOUJOURS pricing cap explicite (max_cost_usd) sur les runs LLM
- TOUJOURS Postgres FOR UPDATE ou function pour les opérations atomiques
- JAMAIS rate-limiter en mémoire process pure (multi-instance Vercel = inefficace) — utiliser Redis/Upstash

## Rapport au orchestrateur

Format identique aux autres fixers.
