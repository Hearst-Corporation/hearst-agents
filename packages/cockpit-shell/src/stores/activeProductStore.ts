/**
 * activeProductStore.ts
 * ─────────────────────────────────────────────────────────────────────────
 * Store externe `useSyncExternalStore` pour le produit actuellement affiché.
 * SSR-safe : `getServerSnapshot` retourne le défaut configuré (cf. `setDefault`).
 *
 * Le store est générique (ne connaît pas la liste des produits du hub) : c'est
 * l'app consommatrice qui définit le défaut au boot via `setDefault("hub")`.
 */

const LS_KEY = "cockpit:active-product";

type Listener = () => void;
const listeners = new Set<Listener>();

let DEFAULT_ID = "hub";

export function setDefaultActive(id: string): void {
  DEFAULT_ID = id;
}

function getSnapshot(): string {
  if (typeof window === "undefined") return DEFAULT_ID;
  const s = window.localStorage.getItem(LS_KEY);
  return s || DEFAULT_ID;
}

function getServerSnapshot(): string {
  return DEFAULT_ID;
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

function setActive(id: string): void {
  if (getSnapshot() === id) return;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LS_KEY, id);
  }
  notifyAll();
}

export { subscribe, getSnapshot, getServerSnapshot, setActive };
