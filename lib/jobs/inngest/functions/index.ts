/**
 * Registre des fonctions Inngest — exporté pour le handler /api/inngest.
 *
 * Importe chaque fonction et la regroupe dans `inngestFunctions[]`. Ce
 * fichier est isolé de `lib/jobs/inngest/client.ts` pour éviter une
 * dépendance circulaire (les fonctions importent `inngest` depuis
 * client.ts).
 */

import { audioGenFunction } from "./audio-gen";
import { codeExecFunction } from "./code-exec";
import { computerActionRunFunction } from "./computer-action-run";
import { dailyBriefFunction } from "./daily-brief";
import { documentParseFunction } from "./document-parse";
import { imageGenFunction } from "./image-gen";
import { monthlyCardCronFunction, monthlyCardPerUserFunction } from "./monthly-card";
import { preMeetingIntelFunction } from "./pre-meeting-intel";
import { swarmRunFunction } from "./swarm-run";
import { weeklyDigestCronFunction, weeklyDigestPerUserFunction } from "./weekly-digest";

export const inngestFunctions = [
  dailyBriefFunction,
  weeklyDigestCronFunction,
  weeklyDigestPerUserFunction,
  preMeetingIntelFunction,
  monthlyCardCronFunction,
  monthlyCardPerUserFunction,
  // Phase B jobs — migrated from BullMQ workers (Vercel serverless compatible)
  audioGenFunction,
  imageGenFunction,
  codeExecFunction,
  documentParseFunction,
  // Swarms hive-engine (réflexion multi-agent, 4-8 min)
  swarmRunFunction,
  // Computer-use distant HEARST.AI core/ (jusqu'à 300s)
  computerActionRunFunction,
];
