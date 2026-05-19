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
import type { HubSession } from "./types.js";
/**
 * Récupère la session Supabase active du hub.
 * Retourne `null` si le produit n'est pas embarqué dans le hub OU si le hub
 * n'a pas d'utilisateur connecté.
 */
export declare function getHubSession(): Promise<HubSession | null>;
/**
 * Écoute les changements de session du hub (login/logout). Retourne un
 * unsubscribe. Couvre les 2 modes (Electron + iframe browser).
 */
export declare function onHubSessionChange(cb: (s: HubSession | null) => void): () => void;
/**
 * Helper "tout-en-un" : récupère la session du hub et l'injecte dans un
 * client Supabase local du produit. À appeler côté client au mount d'app.
 *
 * Usage produit :
 *   import { bridgeHubSession } from "@hearst/hub-sdk";
 *   import { supabaseClient } from "@/lib/supabase/client";
 *   await bridgeHubSession(supabaseClient());
 */
export declare function bridgeHubSession(supabaseClient: any): Promise<boolean>;
