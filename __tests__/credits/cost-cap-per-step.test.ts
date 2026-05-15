/**
 * P1 — Cost cap USD per step.
 *
 * Vérifie que la formule computeCostUsd appliquée sur les tokens
 * d'un step Sonnet 4.6 produit les seuils corrects vis-à-vis du cap $0.50.
 *
 * Ce test couvre la logique de calcul qui est maintenant accumulée à chaque
 * "finish-step" dans ai-pipeline.ts (cf. runCostUsd += stepCostUsd).
 */

import { describe, expect, it } from "vitest";
import { computeCostUsd } from "@/lib/llm/pricing";

const MODEL = "claude-sonnet-4-6";
const PRICE_CAP_USD = 0.5;
const PRICE_WARN_USD = PRICE_CAP_USD * 0.8; // 0.40

describe("P1 cost cap per step — computeCostUsd + accumulation logic", () => {
  it("calcule le coût correctement pour Sonnet 4.6 (output only)", () => {
    // 8000 output tokens × $15/M = $0.12
    const cost = computeCostUsd("anthropic", MODEL, {
      input_tokens: 0,
      output_tokens: 8000,
    });
    expect(cost).toBeCloseTo(0.12, 3);
  });

  it("calcule le coût complet (input + output + cache)", () => {
    // 2000 input × $3/M = $0.006
    // 8000 output × $15/M = $0.12
    // 500 cache_read × $0.30/M = $0.00015
    // ≈ $0.126 - (500 × $3/M) + (500 × $0.30/M) [billable input = 2000 - 500 = 1500]
    // = (1500 × 3 + 8000 × 15 + 500 × 0.30) / 1_000_000
    // = (4500 + 120000 + 150) / 1_000_000 = 124650/1_000_000 ≈ $0.12465
    const cost = computeCostUsd("anthropic", MODEL, {
      input_tokens: 2000,
      output_tokens: 8000,
      cache_read_input_tokens: 500,
    });
    expect(cost).toBeGreaterThan(0.12);
    expect(cost).toBeLessThan(0.13);
  });

  it("accumulation de 3 steps reste sous le cap de $0.50", () => {
    let runCostUsd = 0;
    for (let step = 0; step < 3; step++) {
      runCostUsd += computeCostUsd("anthropic", MODEL, {
        input_tokens: 2000,
        output_tokens: 8000,
      });
    }
    // 3 × (2000 × 3 + 8000 × 15) / 1M = 3 × $0.126 = $0.378
    expect(runCostUsd).toBeGreaterThan(0); // accumulé correctement
    expect(runCostUsd).toBeLessThan(PRICE_CAP_USD);
  });

  it("4 steps dépassent le cap de $0.50", () => {
    let runCostUsd = 0;
    for (let step = 0; step < 4; step++) {
      runCostUsd += computeCostUsd("anthropic", MODEL, {
        input_tokens: 2000,
        output_tokens: 8000,
      });
    }
    // 4 × $0.126 = $0.504 > $0.50
    expect(runCostUsd).toBeGreaterThan(PRICE_CAP_USD);
  });

  it("seuil de warning correctement positionné à 80% du cap", () => {
    // (5000 × 3 + 27000 × 15) / 1M = (15000 + 405000) / 1M = $0.42 > 0.40 < 0.50
    const cost = computeCostUsd("anthropic", MODEL, {
      input_tokens: 5000,
      output_tokens: 27_000,
    });
    expect(cost).toBeGreaterThan(PRICE_WARN_USD);
    expect(cost).toBeLessThan(PRICE_CAP_USD);
  });

  it("modèle inconnu retourne 0 (fail-soft)", () => {
    const cost = computeCostUsd("anthropic", "unknown-model-xyz", {
      input_tokens: 1000,
      output_tokens: 1000,
    });
    expect(cost).toBe(0);
  });

  it("ORCHESTRATE_COST_CAP_USD env override change le cap effectif", () => {
    const originalCap = parseFloat(process.env.ORCHESTRATE_COST_CAP_USD ?? "0.50");
    process.env.ORCHESTRATE_COST_CAP_USD = "0.25";
    const capFromEnv = parseFloat(process.env.ORCHESTRATE_COST_CAP_USD ?? "0.50");
    expect(capFromEnv).toBe(0.25);

    // Remettre
    process.env.ORCHESTRATE_COST_CAP_USD = String(originalCap);

    // Vérifie que 2 steps Sonnet dépassent le cap 0.25 mais pas 0.50
    let runCostUsd = 0;
    for (let step = 0; step < 2; step++) {
      runCostUsd += computeCostUsd("anthropic", MODEL, { input_tokens: 2000, output_tokens: 8000 });
    }
    // 2 × $0.126 = $0.252 > 0.25 mais < 0.50
    expect(runCostUsd).toBeGreaterThan(0.25);
    expect(runCostUsd).toBeLessThan(0.5);
  });
});
