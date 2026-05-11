/**
 * Registre des fonctions Inngest — exporté pour le handler /api/inngest.
 *
 * Importe chaque fonction et la regroupe dans `inngestFunctions[]`. Ce
 * fichier est isolé de `lib/jobs/inngest/client.ts` pour éviter une
 * dépendance circulaire (les fonctions importent `inngest` depuis
 * client.ts).
 */

import { dailyBriefFunction } from "./daily-brief";
import {
  weeklyDigestCronFunction,
  weeklyDigestPerUserFunction,
} from "./weekly-digest";
import { preMeetingIntelFunction } from "./pre-meeting-intel";
import {
  monthlyCardCronFunction,
  monthlyCardPerUserFunction,
} from "./monthly-card";
import { audioGenFunction } from "./audio-gen";
import { imageGenFunction } from "./image-gen";
import { codeExecFunction } from "./code-exec";
import { documentParseFunction } from "./document-parse";

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
];
