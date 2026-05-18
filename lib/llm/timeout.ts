import { LLMTimeoutError } from "./errors";

export const CHAT_TIMEOUT_MS = Number(process.env.LLM_CHAT_TIMEOUT_MS ?? "30000");
export const STREAM_TIMEOUT_MS = Number(process.env.LLM_STREAM_TIMEOUT_MS ?? "60000");

/**
 * Watchdog per-chunk : délai max de silence ENTRE deux chunks d'un stream LLM
 * avant d'abort. Différent de STREAM_TIMEOUT_MS (durée totale) : ici on borne
 * un stall mid-stream (1er chunk reçu puis le provider gèle). Sans ça le slot
 * serverless reste bloqué jusqu'à maxDuration (120s). Réarmé à chaque chunk.
 */
export const STREAM_CHUNK_WATCHDOG_MS = Number(process.env.LLM_STREAM_CHUNK_WATCHDOG_MS ?? "15000");

/**
 * Garde-fou d'exécution outil : délai max pendant lequel le SDK peut exécuter
 * la fonction `execute()` d'un tool ENTRE l'event `tool-call` et l'event
 * `tool-result`, SANS qu'aucun event ne circule sur fullStream. C'est NORMAL
 * qu'aucun chunk n'arrive pendant ce gap (le SDK est dans le tool), donc le
 * watchdog token (STREAM_CHUNK_WATCHDOG_MS=15s) est DÉSARMÉ pendant cette phase
 * et ce timer plus long prend le relais. web_search enchaîne jusqu'à 3
 * providers en série (Perplexity research 15-40s → Tavily → Exa), pire cas
 * réaliste ~60-90s : 120s laisse une marge confortable sans bloquer le slot
 * serverless indéfiniment si un tool hang vraiment (cas tool-call sans
 * tool-result). Choix d'un timer dédié plutôt que s'appuyer seulement sur le
 * maxDuration route (120s) : maxDuration borne TOUT le run, ici on veut couper
 * dès qu'UN seul tool hang, avec un message d'erreur distinct du stall stream.
 */
export const STREAM_TOOL_WATCHDOG_MS = Number(process.env.LLM_STREAM_TOOL_WATCHDOG_MS ?? "120000");

export function makeAbortSignal(defaultMs: number, userSignal?: AbortSignal): AbortSignal {
  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort(new LLMTimeoutError("unknown", defaultMs));
  }, defaultMs);

  if (userSignal) {
    if (userSignal.aborted) {
      clearTimeout(timeoutId);
      controller.abort(userSignal.reason);
    } else {
      const abortListener = () => {
        clearTimeout(timeoutId);
        controller.abort(userSignal.reason);
      };
      userSignal.addEventListener("abort", abortListener);
    }
  }

  const origAbort = controller.abort.bind(controller);
  controller.abort = (reason?: unknown) => {
    clearTimeout(timeoutId);
    return origAbort(reason);
  };

  return controller.signal;
}
