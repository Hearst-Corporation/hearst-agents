/**
 * Themes registry — auto-géré par /skin (édition manuelle OK).
 *
 * Idempotent : `/skin <url>` ajoute ou met à jour une entrée par slug.
 * Le thème "default" représente le DS Hearst OS canonique (tokens dans
 * `app/globals.css`) — pas de fichier CSS séparé.
 */

import type { Theme } from "@/lib/themes/types";

export const REGISTRY: Theme[] = [
  {
    slug: "default",
    name: "Hearst OS (default)",
    source: null,
    preview: "/themes/default/preview.svg",
    cssPath: "/themes/default/tokens.css",
    description: "Design system Hearst OS — Ghost Protocol dark, accent teal sourd.",
  },
  {
    slug: "robotflowtemplate-webflow-io",
    name: "Robotflow",
    source: "https://robotflowtemplate.webflow.io/home-pages/home-v1",
    preview: "/themes/robotflowtemplate-webflow-io/preview.png",
    cssPath: "/themes/robotflowtemplate-webflow-io/tokens.css",
    capturedAt: "2026-05-15",
    description:
      "Tech dark futuriste — accent violet électrique, coins ultra-arrondis, Inter Tight.",
  },
];
