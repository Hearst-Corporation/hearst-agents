/**
 * Inngest HTTP handler — endpoint que la plateforme Inngest appelle pour
 * exécuter les fonctions sur Vercel.
 *
 * URL : https://<your-app>/api/inngest
 * À enregistrer dans le dashboard Inngest (Settings → Apps).
 */

import { serve } from "inngest/next";
import { assertInngestSigningKey } from "@/lib/jobs/inngest/check";
import { inngest } from "@/lib/jobs/inngest/client";
import { inngestFunctions } from "@/lib/jobs/inngest/functions";

// Garde-fou F-007 : hard-throw au boot en prod si INNGEST_SIGNING_KEY absente
// (warn-only en dev). Sans la clé, /api/inngest accepterait tout POST.
assertInngestSigningKey();

// INNGEST_SIGNING_KEY est lu automatiquement depuis l'env par le SDK.
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: inngestFunctions,
});
