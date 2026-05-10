/**
 * TimelineRail — re-export shim.
 *
 * L'implémentation a été découpée sous `./timeline-rail/`. Ce fichier
 * existe pour préserver l'API publique historique (`import { TimelineRail }
 * from "./TimelineRail"`) sans casser les consommateurs (LeftPanelShell, etc.).
 */

export { TimelineRail } from "./timeline-rail";
