/**
 * Policy engine HOM — moteur déclaratif minimal.
 * Whitelist par défaut : une action sans rule explicite = deny.
 * L'évaluation se fait avant chaque action sensible (write, delete, spawn).
 */

import { readJson } from "./fs-utils";
import { HOM } from "./paths";
import type { AgentId, FleetPolicy, PolicyDecision, PolicyRule, ReleasePolicy } from "./types";

export interface PolicyContext {
  agent_id: AgentId | "master";
  action: string;
  scope?: string;
}

export interface PolicyResult {
  decision: PolicyDecision;
  rule_id: string | null;
  reason: string;
}

let cachedFleet: FleetPolicy | null = null;
let cachedRelease: ReleasePolicy | null = null;

export async function loadFleetPolicy(): Promise<FleetPolicy> {
  if (cachedFleet) return cachedFleet;
  const data = await readJson<FleetPolicy>(HOM.fleetPolicy);
  if (!data) throw new Error("Fleet policy missing — run hom:bootstrap");
  cachedFleet = data;
  return data;
}

export async function loadReleasePolicy(): Promise<ReleasePolicy> {
  if (cachedRelease) return cachedRelease;
  const data = await readJson<ReleasePolicy>(HOM.releasePolicy);
  if (!data) throw new Error("Release policy missing — run hom:bootstrap");
  cachedRelease = data;
  return data;
}

export function clearPolicyCache() {
  cachedFleet = null;
  cachedRelease = null;
}

function matchesScope(rule: PolicyRule, scope: string | undefined): boolean {
  if (!rule.scope) return true;
  if (!scope) return false;
  if (rule.scope === scope) return true;
  if (rule.scope.endsWith("/**")) {
    const prefix = rule.scope.slice(0, -3);
    return scope.startsWith(prefix);
  }
  if (rule.scope.endsWith("/*")) {
    const prefix = rule.scope.slice(0, -2);
    return scope.startsWith(prefix) && !scope.slice(prefix.length).includes("/");
  }
  return false;
}

export async function evaluate(ctx: PolicyContext): Promise<PolicyResult> {
  const fleet = await loadFleetPolicy();
  for (const rule of fleet.rules) {
    if (rule.action !== ctx.action) continue;
    if (!matchesScope(rule, ctx.scope)) continue;
    if (rule.exception?.includes(ctx.agent_id)) {
      return {
        decision: "allow",
        rule_id: rule.id,
        reason: "exception",
      };
    }
    return {
      decision: rule.decision,
      rule_id: rule.id,
      reason: rule.appender_only ? "append-only enforced" : "matched rule",
    };
  }
  return {
    decision: "deny",
    rule_id: null,
    reason: "default-deny (whitelist)",
  };
}

/** Évalue toutes les release gates. Renvoie la liste des gates en échec. */
export interface ReleaseGateResult {
  id: string;
  rule: string;
  blocking: boolean;
  passed: boolean;
  reason: string;
}

export async function evaluateReleaseGates(ctx: ReleaseGateContext): Promise<ReleaseGateResult[]> {
  const policy = await loadReleasePolicy();
  return policy.gates.map((g) => {
    const passed = checkGate(g.rule, ctx);
    return {
      id: g.id,
      rule: g.rule,
      blocking: g.blocking,
      passed,
      reason: passed ? "ok" : `gate failed: ${g.rule}`,
    };
  });
}

export interface ReleaseGateContext {
  trustScores: { [key: string]: number };
  hasCritical: boolean;
  hasHighDriftUnresolved: boolean;
  manifestSynced: boolean;
  humanSignaturePresent: boolean;
  acceptedDebtValid: boolean;
}

function checkGate(rule: string, ctx: ReleaseGateContext): boolean {
  switch (rule) {
    case "all_trust_scores >= 75":
      return Object.values(ctx.trustScores).every((s) => s >= 75);
    case "no_critical_open":
      return !ctx.hasCritical;
    case "no_drift_high_unresolved":
      return !ctx.hasHighDriftUnresolved;
    case "manifest_features_synced":
      return ctx.manifestSynced;
    case "human_signature_present":
      return ctx.humanSignaturePresent;
    case "accepted_debt_review_dates_valid":
      return ctx.acceptedDebtValid;
    default:
      return false;
  }
}
