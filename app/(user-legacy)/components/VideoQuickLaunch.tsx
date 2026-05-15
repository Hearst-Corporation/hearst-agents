"use client";

/**
 * VideoQuickLaunch — re-export shim.
 *
 * Le composant a été découpé dans `./video-quick-launch/` (P1) pour rester
 * maintenable. Ce fichier conserve l'import path historique
 * (`@/app/(user-legacy)/components/VideoQuickLaunch`) → zero breaking change pour
 * les consommateurs (layout, hooks, etc.).
 */

export { VideoQuickLaunchPanel as VideoQuickLaunch } from "./video-quick-launch/VideoQuickLaunchPanel";
