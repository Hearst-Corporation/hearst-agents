/**
 * hubBridge.ts
 * ─────────────────────────────────────────────────────────────────────────
 * Relaie les appels IPC d'une `<webview>` produit vers le main process via
 * `window.electron.hubInvoke` (exposé par le preload côté hub Electron).
 *
 * Contrat IPC :
 *   webview → host : événement DOM "ipc-message", e.channel === "hearsthub:req",
 *                    e.args[0] = { reqId, channel, args }
 *   host → webview : webviewEl.send("hearsthub:res", { reqId, ok, result, error })
 *                    webviewEl.send("hearsthub:ctx", { productId, env, accent, theme })
 *   host → main    : window.electron.hubInvoke(channel, { productId, args }) → Promise
 *
 * Export depuis `@hearst/cockpit-shell` pour que le hub agrégateur l'utilise
 * dans son `ProductFrame`. Les apps produit standalone n'en ont pas besoin.
 */

declare global {
  interface Window {
    electron?: {
      getLastEnv?: () => Promise<string>;
      selectEnv?: (env: "local" | "prod") => Promise<void>;
      platform?: string;
      hubInvoke?: (
        channel: string,
        payload: { productId: string; args: unknown },
      ) => Promise<unknown>;
    };
  }
}

const CH_REQ = "hearsthub:req";
const CH_RES = "hearsthub:res";
const CH_CTX = "hearsthub:ctx";

interface IpcMessageEvent extends Event {
  channel: string;
  args: unknown[];
}

interface HubReqPayload {
  reqId: number;
  channel: string;
  args: unknown;
}

export interface HubContext {
  productId: string;
  env: string;
  accent: string;
  theme: string;
}

interface WebviewElement {
  send(channel: string, ...args: unknown[]): void;
  addEventListener(type: string, handler: (e: IpcMessageEvent) => void): void;
  removeEventListener(
    type: string,
    handler: (e: IpcMessageEvent) => void,
  ): void;
}

function isHubReqPayload(v: unknown): v is HubReqPayload {
  if (!v || typeof v !== "object") return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p["reqId"] === "number" &&
    typeof p["channel"] === "string" &&
    (p["channel"] as string).length > 0
  );
}

export function attachHubBridge(
  webviewEl: WebviewElement,
  getProductId: () => string,
): () => void {
  const handler = async (e: IpcMessageEvent): Promise<void> => {
    if (e.channel !== CH_REQ) return;

    const raw = e.args[0];
    if (!isHubReqPayload(raw)) return;
    const payload: HubReqPayload = raw;
    const { reqId, channel, args } = payload;

    if (channel === "telemetry" || (typeof reqId === "number" && reqId < 0)) {
      if (process.env.NODE_ENV === "development") {
        console.debug("[hubBridge] telemetry drop", { channel, args });
      }
      return;
    }

    if (typeof window.electron?.hubInvoke !== "function") {
      webviewEl.send(CH_RES, { reqId, ok: false, error: "no bridge" });
      return;
    }

    const productId = getProductId();

    try {
      const r = await window.electron.hubInvoke(channel, { productId, args });
      if (
        r &&
        typeof r === "object" &&
        "ok" in r &&
        (r as { ok: boolean }).ok === false
      ) {
        webviewEl.send(CH_RES, {
          reqId,
          ok: false,
          error: (r as { error?: string }).error ?? "HubError",
        });
      } else {
        const result =
          r && typeof r === "object" && "result" in r
            ? (r as { result: unknown }).result
            : r;
        webviewEl.send(CH_RES, { reqId, ok: true, result });
      }
    } catch (err) {
      webviewEl.send(CH_RES, { reqId, ok: false, error: String(err) });
    }
  };

  webviewEl.addEventListener("ipc-message", handler);

  return () => {
    webviewEl.removeEventListener("ipc-message", handler);
  };
}

export function pushContext(
  webviewEl: WebviewElement,
  ctx: HubContext,
): void {
  webviewEl.send(CH_CTX, ctx);
}
