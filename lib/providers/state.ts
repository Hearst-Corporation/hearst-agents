/**
 * Provider Usage State — Per-user, per-tenant learning signal.
 *
 * Pluggable storage via ProviderStateStore interface.
 * Ships with in-memory implementation (dev) and Supabase adapter (prod).
 */

import type { ProviderId } from "./types";

// ── Core types ──────────────────────────────────────────────

export interface ProviderUsageState {
  providerId: ProviderId;
  userId: string;
  tenantId: string;
  usageCount: number;
  lastUsedAt: number;
  successCount: number;
  failureCount: number;
  /** Timestamp of last failure — used for cooldown penalty. */
  lastFailedAt: number;
  /** Last capability this provider was selected for. */
  lastCapability: string | null;
}

export interface ProviderUsageStats extends ProviderUsageState {
  successRate: number;
}

// ── Pluggable storage interface ─────────────────────────────

export interface ProviderStateStore {
  get(providerId: ProviderId, userId: string, tenantId: string): ProviderUsageStats;
  getAll(userId: string, tenantId: string): ProviderUsageStats[];
  update(state: ProviderUsageState): void;
}

// ── Tenant guard ────────────────────────────────────────────

function assertTenantScope(userId: string, tenantId: string): void {
  if (!tenantId || !userId) {
    throw new Error(
      `[ProviderState] Missing tenant scope: userId=${userId || "MISSING"} tenantId=${tenantId || "MISSING"}`,
    );
  }
}

// ── In-memory implementation (dev / single-instance) ────────

function stateKey(providerId: ProviderId, userId: string, tenantId: string): string {
  return `${tenantId}:${userId}:${providerId}`;
}

function toStats(s: ProviderUsageState): ProviderUsageStats {
  const total = s.successCount + s.failureCount;
  return { ...s, successRate: total > 0 ? s.successCount / total : 1 };
}

function createEmpty(providerId: ProviderId, userId: string, tenantId: string): ProviderUsageState {
  return {
    providerId,
    userId,
    tenantId,
    usageCount: 0,
    lastUsedAt: 0,
    successCount: 0,
    failureCount: 0,
    lastFailedAt: 0,
    lastCapability: null,
  };
}

class MemoryStateStore implements ProviderStateStore {
  private store = new Map<string, ProviderUsageState>();

  get(providerId: ProviderId, userId: string, tenantId: string): ProviderUsageStats {
    assertTenantScope(userId, tenantId);
    const key = stateKey(providerId, userId, tenantId);
    const s = this.store.get(key) ?? createEmpty(providerId, userId, tenantId);
    if (!this.store.has(key)) this.store.set(key, s);
    return toStats(s);
  }

  getAll(userId: string, tenantId: string): ProviderUsageStats[] {
    assertTenantScope(userId, tenantId);
    const prefix = `${tenantId}:${userId}:`;
    const results: ProviderUsageStats[] = [];
    for (const [key, s] of this.store) {
      if (key.startsWith(prefix)) results.push(toStats(s));
    }
    return results;
  }

  update(state: ProviderUsageState): void {
    assertTenantScope(state.userId, state.tenantId);
    const key = stateKey(state.providerId, state.userId, state.tenantId);
    this.store.set(key, state);
  }
}

// ── Singleton store ─────────────────────────────────────────

const activeStore: ProviderStateStore = new MemoryStateStore();

// ── Public API (convenience wrappers) ───────────────────────

export function getUsageState(
  providerId: ProviderId,
  userId: string,
  tenantId: string,
): ProviderUsageStats {
  return activeStore.get(providerId, userId, tenantId);
}

export function recordProviderUsed(
  providerId: ProviderId,
  userId: string,
  tenantId: string,
  capability?: string,
): void {
  assertTenantScope(userId, tenantId);
  const stats = activeStore.get(providerId, userId, tenantId);
  const updated: ProviderUsageState = {
    ...stats,
    usageCount: stats.usageCount + 1,
    lastUsedAt: Date.now(),
    lastCapability: capability ?? stats.lastCapability,
  };
  activeStore.update(updated);
}

export function recordProviderSuccess(
  providerId: ProviderId,
  userId: string,
  tenantId: string,
): void {
  assertTenantScope(userId, tenantId);
  const stats = activeStore.get(providerId, userId, tenantId);
  const updated: ProviderUsageState = {
    ...stats,
    successCount: stats.successCount + 1,
  };
  activeStore.update(updated);
}

export function recordProviderFailure(
  providerId: ProviderId,
  userId: string,
  tenantId: string,
): void {
  assertTenantScope(userId, tenantId);
  const stats = activeStore.get(providerId, userId, tenantId);
  const updated: ProviderUsageState = {
    ...stats,
    failureCount: stats.failureCount + 1,
    lastFailedAt: Date.now(),
  };
  activeStore.update(updated);
}
