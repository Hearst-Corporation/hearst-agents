/**
 * auth.ts — Client SSO consommé par les produits Hearst.
 *
 * Récupère la session Supabase partagée par le hub Hearst Cockpit. Deux modes
 * de transport couverts par le même client :
 *
 *   1. Electron (webview Hearst Hub) : `window.hearstHub.auth.getSession()`
 *      exposé par le preload du hub Electron. Synchrone côté DOM.
 *
 *   2. Browser (<iframe> embed sur localhost:4200) : postMessage cross-origin
 *      vers `window.parent`. Le hub écoute "hearsthub:auth:req" et répond
 *      "hearsthub:auth:res". Origines hub autorisées : localhost:4200/4201 +
 *      hearst-corporation.vercel.app.
 *
 * Les produits qui ne tournent PAS dans le hub (standalone) reçoivent `null`
 * — ils doivent alors lancer leur propre flow login Supabase classique.
 */
const POSTMSG_REQ = "hearsthub:auth:req";
const POSTMSG_RES = "hearsthub:auth:res";
const POSTMSG_CHANGE = "hearsthub:auth:change";
/**
 * Récupère la session Supabase active du hub.
 * Retourne `null` si le produit n'est pas embarqué dans le hub OU si le hub
 * n'a pas d'utilisateur connecté.
 */
export async function getHubSession() {
    if (typeof window === "undefined")
        return null;
    // Mode Electron : preload a injecté window.hearstHub.
    if (window.hearstHub?.auth?.getSession) {
        try {
            return await window.hearstHub.auth.getSession();
        }
        catch {
            return null;
        }
    }
    // Mode browser <iframe> : postMessage au parent.
    if (window.parent && window.parent !== window) {
        return new Promise((resolve) => {
            const reqId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
            let settled = false;
            const onMessage = (e) => {
                const data = e.data;
                if (!data || data.type !== POSTMSG_RES || data.reqId !== reqId)
                    return;
                settled = true;
                window.removeEventListener("message", onMessage);
                resolve(data.session ?? null);
            };
            window.addEventListener("message", onMessage);
            // Origine '*' OK : la session est consommée par le hub via postMessage
            // qui filtre côté hub par origin. Ici on émet juste la requête.
            window.parent.postMessage({ type: POSTMSG_REQ, reqId }, "*");
            // Timeout 1s — si pas de réponse, le parent n'est pas le hub.
            window.setTimeout(() => {
                if (settled)
                    return;
                window.removeEventListener("message", onMessage);
                resolve(null);
            }, 1000);
        });
    }
    return null;
}
/**
 * Écoute les changements de session du hub (login/logout). Retourne un
 * unsubscribe. Couvre les 2 modes (Electron + iframe browser).
 */
export function onHubSessionChange(cb) {
    if (typeof window === "undefined")
        return () => { };
    // Mode Electron.
    if (window.hearstHub?.auth?.onSessionChange) {
        try {
            return window.hearstHub.auth.onSessionChange(cb);
        }
        catch {
            return () => { };
        }
    }
    // Mode iframe browser : écoute les broadcasts du hub.
    const onMessage = (e) => {
        const data = e.data;
        if (!data || data.type !== POSTMSG_CHANGE)
            return;
        cb(data.session ?? null);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
}
/**
 * Helper "tout-en-un" : récupère la session du hub et l'injecte dans un
 * client Supabase local du produit. À appeler côté client au mount d'app.
 *
 * Usage produit :
 *   import { bridgeHubSession } from "@hearst/hub-sdk";
 *   import { supabaseClient } from "@/lib/supabase/client";
 *   await bridgeHubSession(supabaseClient());
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function bridgeHubSession(supabaseClient) {
    const session = await getHubSession();
    if (!session)
        return false;
    try {
        await supabaseClient.auth.setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
        });
        return true;
    }
    catch {
        return false;
    }
}
