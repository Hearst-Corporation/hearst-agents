// Public surface du runtime engine.
//
// Convention : la majorité des consommateurs internes au repo importent
// directement depuis les sous-modules (ex: `@/lib/engine/runtime/missions/store`).
// Ce barrel n'expose volontairement que les symbols utilisés par des consommateurs
// externes au module + quelques utilitaires génériques publiables (lifecycle).
//
// Si tu ajoutes un export ici, vérifie d'abord qu'il a un consommateur réel via
// `grep -rn "from \"@/lib/engine/runtime\"" app lib`.

export { RunTracer } from "./tracer";

export { enforceMemoryPolicy } from "./memory-governor";

// Utilitaires génériques (lifecycle) — exposés pour réutilisation transverse.
export { RuntimeError, withTimeout, withRetry } from "./lifecycle";
