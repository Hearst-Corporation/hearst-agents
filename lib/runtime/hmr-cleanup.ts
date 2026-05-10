/**
 * HMR Cleanup Guard — Stops all timers before Next.js hot-reload.
 *
 * Problem: Next.js dev mode uses HMR which doesn't trigger SIGTERM/SIGINT.
 * Old setInterval/setTimeout instances remain active after module reload,
 * causing memory leaks and process accumulation.
 *
 * Solution: Register cleanup callbacks that run before HMR dispose.
 * Use in any module with setInterval/setTimeout:
 *
 * ```ts
 * import { registerHMRCleanup } from '@/lib/runtime/hmr-cleanup';
 *
 * const timer = setInterval(() => { ... }, 60000);
 * registerHMRCleanup(() => clearInterval(timer));
 * ```
 */

type CleanupFn = () => void;

const cleanupRegistry: CleanupFn[] = [];

/**
 * Register a cleanup function to run before HMR dispose.
 * Returns an unregister function.
 */
export function registerHMRCleanup(fn: CleanupFn): () => void {
  cleanupRegistry.push(fn);
  return () => {
    const idx = cleanupRegistry.indexOf(fn);
    if (idx > -1) cleanupRegistry.splice(idx, 1);
  };
}

/**
 * Run all registered cleanup functions.
 * Called automatically by HMR dispose hook.
 */
function runAllCleanups(): void {
  console.log(`[HMR] Running ${cleanupRegistry.length} cleanup(s)`);
  for (const fn of cleanupRegistry) {
    try {
      fn();
    } catch (err) {
      console.error("[HMR] Cleanup error:", err);
    }
  }
  cleanupRegistry.length = 0;
}

// Register HMR dispose hook (Next.js dev only)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (typeof module !== "undefined" && (module as any).hot) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (module as any).hot.dispose(() => {
    runAllCleanups();
  });
}

// Fallback: SIGTERM/SIGINT for production
if (typeof process !== "undefined") {
  const cleanup = () => {
    runAllCleanups();
    process.exit(0);
  };
  process.once("SIGTERM", cleanup);
  process.once("SIGINT", cleanup);
}
