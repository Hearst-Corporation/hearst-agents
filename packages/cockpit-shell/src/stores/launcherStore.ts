/**
 * launcherStore.ts
 * ─────────────────────────────────────────────────────────────────────────
 * État ouvert/replié du lanceur du rail gauche (accordéon).
 * Pattern SSR-safe identique à `railOpenStore` : snapshot serveur = ouvert.
 */

const LS_KEY = "cockpit:launcher-open";

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

function set(open: boolean): void {
  if (getSnapshot() === open) return;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LS_KEY, open ? "1" : "0");
  }
  listeners.forEach((cb) => cb());
}

export { subscribe, getSnapshot, getServerSnapshot, set };
