/**
 * PermanentJobError — erreur non retriable.
 *
 * À lever dans les workers BullMQ ou les fonctions Inngest quand l'erreur
 * est définitivement non récupérable (4xx provider, input invalide, auth
 * échouée). BullMQ ne re-tente pas automatiquement sur ce type d'erreur si
 * le worker check la classe avant de throw (cf. worker-base.ts).
 *
 * Convention :
 *  - Status 401/403 provider → PermanentJobError (mauvaise clé API, accès refusé)
 *  - Status 400 provider → PermanentJobError (payload invalide côté provider)
 *  - Status 5xx / network → throw normal (erreur transiente → retry BullMQ)
 */
export class PermanentJobError extends Error {
  readonly isPermanent = true;

  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "PermanentJobError";
  }
}

/** Type-guard pour identifier une PermanentJobError. */
export function isPermanentError(err: unknown): err is PermanentJobError {
  return (
    err instanceof PermanentJobError ||
    (typeof err === "object" &&
      err !== null &&
      "isPermanent" in err &&
      (err as { isPermanent?: unknown }).isPermanent === true)
  );
}
