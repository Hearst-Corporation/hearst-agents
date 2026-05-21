/**
 * UI primitives — design system Hearst OS.
 *
 * Re-exporte les primitives unifiées du DS pour import simple :
 *   import { Action, SectionHeader, RailSection } from "@/app/(user)/components/ui";
 */

export type { ActionSize, ActionTone, ActionVariant } from "./Action";
export { Action } from "./Action";
export { EmptyState } from "./EmptyState";
export { FilterTabs } from "./FilterTabs";
export { FormInput, FormTextarea } from "./FormField";
export type { IconButtonProps } from "./IconButton";
export { IconButton } from "./IconButton";
export { PanelCard } from "./PanelCard";
export { RailSection } from "./RailSection";
export { ScreenShell } from "./ScreenShell";
export { SearchField } from "./SearchField";
export { SectionEyebrow } from "./SectionEyebrow";
export { SectionHeader } from "./SectionHeader";
export { CardSkeleton, RowSkeleton } from "./Skeleton";
export { StageErrorBanner } from "./StageErrorBanner";
export { FieldError, fieldA11yProps, ValidatedForm } from "./ValidatedForm";
