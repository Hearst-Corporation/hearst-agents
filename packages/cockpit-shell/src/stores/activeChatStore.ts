/**
 * activeChatStore.ts — chatId de la conversation actuellement chargée dans le chat.
 * - null = nouvelle conversation (sera créée au 1er send).
 * - uuid = conversation existante reprise depuis l'historique.
 */

type Listener = () => void;
const listeners = new Set<Listener>();
let current: string | null = null;

function getSnapshot(): string | null { return current; }
function getServerSnapshot(): string | null { return null; }

function subscribe(cb: Listener): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function setActiveChat(id: string | null): void {
  current = id;
  listeners.forEach((cb) => cb());
}

export { subscribe, getSnapshot, getServerSnapshot, setActiveChat };
