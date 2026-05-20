/**
 * UI primitives — design system Hearst OS.
 *
 * Re-exporte les primitives unifiées du DS pour import simple :
 *   import { Action, SectionHeader, RailSection } from "@/app/(user)/components/ui";
 */

export type { ActionSize, ActionTone, ActionVariant } from "./Action";
export { Action } from "./Action";
export { EmptyState } from "./EmptyState";
export type { ModalShellProps } from "./ModalShell";
export { ModalShell } from "./ModalShell";
export { RailSection } from "./RailSection";
export { ScreenShell } from "./ScreenShell";
export { SectionHeader } from "./SectionHeader";
export { CardSkeleton, RowSkeleton } from "./Skeleton";
export { FieldError, ValidatedForm } from "./ValidatedForm";
