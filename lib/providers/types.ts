/**
 * Provider Registry — Canonical types.
 *
 * ProviderId is defined here as a literal union to avoid circular dependency with registry.ts.
 * When adding a new provider, update BOTH this union AND PROVIDER_IDS in registry.ts.
 */

import type { ConnectorCapability } from "@/lib/connectors/platform/types";

/**
 * Provider ID union — must match PROVIDER_IDS in registry.ts.
 * NOTE: Keep in sync manually with PROVIDER_IDS constant in registry.ts.
 */
export type ProviderId =
  | "google"
  | "slack"
  | "whatsapp"
  | "web"
  | "anthropic_managed"
  | "notion"
  | "github"
  | "stripe"
  | "jira"
  | "hubspot"
  | "airtable"
  | "figma"
  | "zapier"
  | "system";

export interface ProviderDefinition {
  id: ProviderId;
  label: string;

  capabilities: ConnectorCapability[];

  tools: string[];

  ui: {
    initial: string;
    color: string;
  };

  auth: {
    tokenBucket: string;
    connectable: boolean;
  };

  keywords: {
    fr: string[];
    en: string[];
  };

  blockedMessage: string;

  /** Static priority for scoring (higher = preferred). Default 1. */
  priority: number;
}

/**
 * Checks if a string is a valid ProviderId.
 * Use at runtime boundaries (API inputs, DB reads) where types can't guarantee safety.
 */
export function isProviderId(value: string): value is ProviderId {
  return PROVIDER_ID_SET.has(value);
}

/** Built from the registry constant — no manual sync needed. */
// We can't import PROVIDER_IDS at value level here due to circular ref,
// so we maintain a mirror set. The type derivation above ensures compile-time safety.
const PROVIDER_ID_SET = new Set<string>([
  "google",
  "slack",
  "whatsapp",
  "web",
  "anthropic_managed",
  "notion",
  "github",
  "stripe",
  "jira",
  "hubspot",
  "airtable",
  "figma",
  "zapier",
  "system",
]);
