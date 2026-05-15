/**
 * Core Types — Canonical type exports for Hearst OS.
 *
 * Architecture Finale alignment: lib/core/types/ is the single source of truth
 * for all domain types. Re-exports from stores/, engine/, and focal domain.
 *
 * Usage: import type { Asset, RunRecord, AgentDefinition } from "@/lib/core/types"
 */

export type { ConnectedAccount, DiscoveredTool } from "@/lib/connectors/composio";

// ── Connectors — only Composio + the platform's plug shape remain ─────
export type { ConnectorCapability, ConnectorDefinition } from "@/lib/connectors/platform/types";
// ── Connectors (Unified — legacy re-export) ────────────────
export type {
  ServiceDefinition,
  ServiceWithConnectionStatus,
} from "@/lib/integrations/types";
// ── Right Panel (UI View Model) ────────────────────────────
export type {
  FocalObjectView,
  RightPanelAsset,
  RightPanelCurrentRun,
  RightPanelData,
  RightPanelMission,
  RightPanelReportSuggestion,
  RightPanelRun,
} from "@/lib/ui/right-panel/types";
// ── Focal Object System (Canonical) ─────────────────────────
export type {
  FocalObject,
  FocalStatus,
  FocalType,
} from "@/stores/focal";
// ── Navigation & Thread System ──────────────────────────────
export type {
  Message,
  Surface,
  Thread,
} from "@/stores/navigation";
// ── Runtime & Streaming ────────────────────────────────────
export type {
  CoreState,
  StreamEvent,
} from "@/stores/runtime";
// ── Agents ──────────────────────────────────────────────────
export type { AgentDefinition, CapabilityAgent, StepActor } from "./agents";
// ── Assets ──────────────────────────────────────────────────
export type {
  Action,
  ActionStatus,
  ActionType,
  Asset,
  AssetFileInfo,
  AssetKind,
  AssetProvenance,
  AssetStorageKind,
  AssetType,
  DownloadResult,
  RuntimeAsset,
  SignedUrlOptions,
  StorageConfig,
  StorageObject,
  StorageProvider,
  StorageProviderType,
  UploadResult,
} from "./assets";
// ── Common ──────────────────────────────────────────────────
export type {
  ApiResponse,
  PaginatedResult,
  ProviderId,
  TenantScope,
  Timestamp,
} from "./common";
// ── Focal Utilities ────────────────────────────────────────
export {
  type FocalMappingOptions,
  mapFocalObject,
  mapFocalObjects,
} from "./focal";
// ── Runtime ─────────────────────────────────────────────────
export type {
  PersistedMissionRunStatus,
  PersistedRunRecord,
  PersistedRunStatus,
  PersistedScheduledMission,
  RunAssetRef,
  RunRecord,
  RunStatus,
  TimelineItem,
  TimelineItemType,
  TimelineSeverity,
} from "./runtime";
