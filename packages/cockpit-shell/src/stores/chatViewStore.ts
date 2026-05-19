/**
 * chatViewStore.ts — bascule chat ↔ settings dans le RailRight.
 * Persisté en localStorage, SSR-safe (défaut : "chat").
 */

const LS_KEY = "cockpit:chat-view";

type View = "chat" | "settings" | "history";
const ALLOWED: ReadonlyArray<View> = ["chat", "settings", "history"];
type Listener = () => void;
const listeners = new Set<Listener>();

function getSnapshot(): View {
  if (typeof window === "undefined") return "chat";
  const s = window.localStorage.getItem(LS_KEY);
  return ALLOWED.includes(s as View) ? (s as View) : "chat";
}

function getServerSnapshot(): View {
  return "chat";
}

function subscribe(cb: Listener): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function notifyAll() { listeners.forEach((cb) => cb()); }

function setView(v: View): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LS_KEY, v);
  }
  notifyAll();
}

function toggle(): void {
  setView(getSnapshot() === "chat" ? "settings" : "chat");
}

export { subscribe, getSnapshot, getServerSnapshot, setView, toggle };
export type { View };
