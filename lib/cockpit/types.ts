/**
 * Types partagés pour l'orchestrateur Cockpit.
 * Fichier neutre pour casser les dépendances circulaires.
 */

export interface CockpitAgendaItem {
  id: string;
  title: string;
  startsAt: number;
  source: "mock" | "live";
}
