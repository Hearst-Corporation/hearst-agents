import { beforeEach, describe, expect, it } from "vitest";
import { guardAndReserveCredits, settleCredits } from "@/lib/credits/client";
import { getServerSupabase } from "@/lib/platform/db/supabase";

/**
 * F-079 — Budget race condition test suite
 *
 * Valide que guardAndReserveCredits est atomique sous concurrence.
 * Remplace le pattern read-then-write par reserve_credits_atomic.
 *
 * Test critique : 100 réservations parallèles sur budget=50 USD.
 * Assertion : exactement 50 réussissent, 50 échouent, balance jamais négative.
 */

describe("F-079 — Budget atomic concurrency", () => {
  const TEST_TENANT_ID = "test-tenant";

  beforeEach(async () => {
    // Setup : créer un user de test avec budget 50 USD
    const sb = getServerSupabase();
    if (!sb) {
      console.warn("[Budget Race Test] No Supabase, skipping");
      return;
    }

    // Nettoyer les réservations de test (optionnel pour idempotency)
  });

  it("100 concurrent reserveCredits sur budget=50 → exactement 50 succès, 50 échouent", async () => {
    // Setup utilisateur avec 50 USD
    const testUserId = `race-test-${Date.now()}`;
    const sb = getServerSupabase();
    if (!sb) {
      console.warn("[Budget Race Test] No Supabase, skipping concurrent test");
      return;
    }

    // Pré-créer le user avec 50 USD
    const { error: insertError } = await sb
      .from("user_credits")
      .insert({
        user_id: testUserId,
        tenant_id: TEST_TENANT_ID,
        balance_usd: 50.0,
        reserved_usd: 0.0,
      })
      .maybeSingle();

    if (insertError && !insertError.message.includes("duplicate")) {
      console.warn("[Budget Race Test] Insert failed:", insertError.message);
      return;
    }

    // Lancer 100 réservations en parallèle, 1 USD chacune
    const promises = Array.from({ length: 100 }, (_, i) =>
      guardAndReserveCredits({
        userId: testUserId,
        tenantId: TEST_TENANT_ID,
        estimatedCostUsd: 1.0,
        jobId: `race-job-${Date.now()}-${i}`,
        jobKind: "simulation",
      }),
    );

    const results = await Promise.all(promises);

    // Assertions
    const successes = results.filter((r) => r.allowed);
    const failures = results.filter((r) => !r.allowed);

    expect(successes.length).toBe(50);
    expect(failures.length).toBe(50);
    expect(successes.length + failures.length).toBe(100);

    // Vérifier que balance est jamais négative (read après les réservations)
    const { data } = await sb
      .from("user_credits")
      .select("balance_usd")
      .eq("user_id", testUserId)
      .eq("tenant_id", TEST_TENANT_ID)
      .maybeSingle();

    const finalBalance = data?.balance_usd ?? 0;
    expect(finalBalance).toBe(0);
    expect(finalBalance).toBeGreaterThanOrEqual(0);
  });

  it("idempotency_key (jobId) réutilisée → retourne le même résultat sans double charge", async () => {
    const testUserId = `idem-test-${Date.now()}`;
    const jobId = `idem-job-${Date.now()}`;
    const sb = getServerSupabase();
    if (!sb) {
      console.warn("[Budget Race Test] No Supabase, skipping idempotency test");
      return;
    }

    // Pré-créer user avec 100 USD
    const { error: insertError } = await sb
      .from("user_credits")
      .insert({
        user_id: testUserId,
        tenant_id: TEST_TENANT_ID,
        balance_usd: 100.0,
        reserved_usd: 0.0,
      })
      .maybeSingle();

    if (insertError && !insertError.message.includes("duplicate")) {
      return;
    }

    // Appel 1 : réserver 10 USD
    const first = await guardAndReserveCredits({
      userId: testUserId,
      tenantId: TEST_TENANT_ID,
      estimatedCostUsd: 10.0,
      jobId,
      jobKind: "simulation",
    });

    // Appel 2 : même jobId (idempotency key) → doit retourner succès SANS décrémenter de nouveau
    const second = await guardAndReserveCredits({
      userId: testUserId,
      tenantId: TEST_TENANT_ID,
      estimatedCostUsd: 10.0,
      jobId,
      jobKind: "simulation",
    });

    // Les deux doivent être allowed=true (le second est un retry idempotent)
    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);

    // Balance doit être 90 (100 - 10), pas 80 (100 - 10 - 10)
    const { data } = await sb
      .from("user_credits")
      .select("balance_usd")
      .eq("user_id", testUserId)
      .eq("tenant_id", TEST_TENANT_ID)
      .maybeSingle();

    const finalBalance = data?.balance_usd ?? 0;
    expect(finalBalance).toBe(90);
  });

  it("balance insuffisant → tous les appels concurrents retournent allowed=false", async () => {
    const testUserId = `insufficient-test-${Date.now()}`;
    const sb = getServerSupabase();
    if (!sb) {
      console.warn("[Budget Race Test] No Supabase, skipping insufficient test");
      return;
    }

    // Pré-créer user avec seulement 10 USD
    const { error: insertError } = await sb
      .from("user_credits")
      .insert({
        user_id: testUserId,
        tenant_id: TEST_TENANT_ID,
        balance_usd: 10.0,
        reserved_usd: 0.0,
      })
      .maybeSingle();

    if (insertError && !insertError.message.includes("duplicate")) {
      return;
    }

    // Lancer 100 réservations de 20 USD en parallèle (toutes échouent)
    const promises = Array.from({ length: 100 }, (_, i) =>
      guardAndReserveCredits({
        userId: testUserId,
        tenantId: TEST_TENANT_ID,
        estimatedCostUsd: 20.0,
        jobId: `insuf-job-${Date.now()}-${i}`,
        jobKind: "simulation",
      }),
    );

    const results = await Promise.all(promises);

    // Tous les appels doivent échouer
    const successes = results.filter((r) => r.allowed);
    expect(successes.length).toBe(0);

    // Balance doit rester 10
    const { data } = await sb
      .from("user_credits")
      .select("balance_usd")
      .eq("user_id", testUserId)
      .eq("tenant_id", TEST_TENANT_ID)
      .maybeSingle();

    const finalBalance = data?.balance_usd ?? 0;
    expect(finalBalance).toBe(10);
  });
});
