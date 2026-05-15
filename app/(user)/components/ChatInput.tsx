/**
 * Shim de re-export — l'implémentation vit dans `./chat-input/`.
 * Conservé pour la rétrocompatibilité des imports historiques
 * (ChatDock, tests, etc.).
 */

export type { ChatInputProps } from "./chat-input";
export { ChatInput } from "./chat-input";
