/**
 * Core Types — Assets
 *
 * Canonical re-exports for asset types from both domains:
 * - Thread-scoped assets (lib/assets/types.ts) — UI/focal system
 * - Runtime assets (lib/engine/runtime/assets/types.ts) — file generation
 */

export type {
  Action,
  ActionStatus,
  ActionType,
  Asset,
  AssetKind,
  AssetProvenance,
} from "@/lib/assets/types";
export type {
  DownloadResult,
  SignedUrlOptions,
  StorageConfig,
  StorageObject,
  StorageProvider,
  StorageProviderType,
  UploadResult,
} from "@/lib/engine/runtime/assets/storage/types";
export type {
  AssetFileInfo,
  AssetStorageKind,
  AssetType,
  RuntimeAsset,
} from "@/lib/engine/runtime/assets/types";
