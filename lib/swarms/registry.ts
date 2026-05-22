/**
 * Swarm Registry — source de vérité unique pour la map UUID → nom lisible.
 *
 * Remplace les copies locales dans :
 *   - lib/tools/native/swarm.ts
 *   - app/api/v1/swarms/kickoff/route.ts
 */

/** Map UUID → nom lisible pour les 5 swarms connus. */
export const SWARM_NAMES: Record<string, string> = {
  "bfe5d377-15a6-45a2-8536-7ebd89b9141e": "Cortex Note Action Advisor",
  "48b401ac-3a11-43bb-b032-c663203cd402": "Revue de projet",
  "aaaaaaaa-0002-0002-0002-000000000002": "Deep Research Agent",
  "aaaaaaaa-0001-0001-0001-000000000001": "Market Intelligence Scout",
  "7c4d9ac9-778c-4731-b287-e42c45e40f86": "EmailAssistant",
};

/**
 * Résout le nom lisible d'un swarm à partir de son UUID.
 * Retourne l'UUID tel quel si inconnu (safe fallback).
 */
export function resolveSwarmName(id: string): string {
  return SWARM_NAMES[id] ?? id;
}
