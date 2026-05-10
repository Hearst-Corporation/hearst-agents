/**
 * Inngest HTTP handler — endpoint que la plateforme Inngest appelle pour
 * exécuter les fonctions sur Vercel.
 *
 * URL : https://<your-app>/api/inngest
 * À enregistrer dans le dashboard Inngest (Settings → Apps).
 */

import { serve } from "inngest/next";
import { inngest } from "@/lib/jobs/inngest/client";
import { assertInngestSigningKey } from "@/lib/jobs/inngest/check";
import { inngestFunctions } from "@/lib/jobs/inngest/functions";

// Garde-fou : warn bruyant si INNGEST_SIGNING_KEY absente en prod.
assertInngestSigningKey();

// INNGEST_SIGNING_KEY est lu automatiquement depuis l'env par le SDK.
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: inngestFunctions,
});
