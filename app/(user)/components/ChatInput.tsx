/**
 * Shim de re-export — l'implémentation vit dans `./chat-input/`.
 * Conservé pour la rétrocompatibilité des imports historiques
 * (ChatDock, tests, etc.).
 */
export { ChatInput } from "./chat-input";
export type { ChatInputProps } from "./chat-input";
