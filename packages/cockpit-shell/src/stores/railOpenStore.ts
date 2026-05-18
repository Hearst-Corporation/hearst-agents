/**
 * railOpenStore.ts
 * ─────────────────────────────────────────────────────────────────────────
 * Store externe `useSyncExternalStore` pour l'état ouvert/replié du RailRight.
 * SSR-safe : `getServerSnapshot` retourne `true` (défaut ouvert), zéro mismatch.
 */

const LS_KEY = "cockpit:rail-right-open";

type Listener = () => void;
const listeners = new Set<Listener>();

function getSnapshot(): boolean {
  if (typeof window === "undefined") return true;
  const s = window.localStorage.getItem(LS_KEY);
  return s === null ? true : s === "1";
}

function getServerSnapshot(): boolean {
  return true;
}

function subscribe(cb: Listener): () => void {
  listeners.add(cb);

  const onStorage = (e: StorageEvent) => {
    if (e.key === LS_KEY) cb();
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }

  return () => {
    listeners.delete(cb);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

function notifyAll() {
  listeners.forEach((cb) => cb());
}

function toggle(): void {
  const next = !getSnapshot();
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LS_KEY, next ? "1" : "0");
  }
  notifyAll();
}

export { subscribe, getSnapshot, getServerSnapshot, toggle };
