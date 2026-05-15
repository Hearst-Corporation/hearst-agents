/**
 * Types partagés entre Block et BlockActions.
 * Fichier neutre pour casser la dépendance circulaire.
 */

export type BlockType =
  | "section_heading"
  | "subsection_heading"
  | "list"
  | "action_items"
  | "insight"
  | "paragraph";

export type BlockActionId = "expand" | "mission" | "asset" | "edit" | "refine";

export interface BlockProps {
  content: string;
  editable?: boolean;
  onSave?: (newContent: string) => void;
  onAction?: (action: BlockActionId) => void;
}
