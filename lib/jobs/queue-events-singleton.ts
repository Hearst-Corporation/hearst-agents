/**
 * QueueEvents singleton — Pattern C reliability.
 *
 * BullMQ QueueEvents ouvre une connexion Redis bloquante dédiée par instance.
 * Instancier `new QueueEvents(...)` dans chaque SSE handler crée un leak de
 * connexions Redis (1 connexion par SSE ouvert, jamais fermée si le handler
 * ne gère pas correctement le close).
 *
 * Ce singleton garantit :
 *  - 1 seule instance QueueEvents par queueName (partagée entre toutes les
 *    connexions SSE actives pour la même queue)
 *  - SIGTERM / SIGINT / beforeExit → close() propre sur toutes les instances
 */

import { QueueEvents } from "bullmq";
import { getBullConnection } from "./connection";

const queueEventsByName = new Map<string, QueueEvents>();
let cleanupRegistered = false;

/**
 * Retourne (ou crée) un singleton QueueEvents pour `queueName`.
 * Chaque instance partage une connexion Redis dupliquée (BullMQ l'exige pour
 * les blocking commands — pas la même connexion que la Queue).
 *
 * Retourne `null` si REDIS_URL n'est pas configuré.
 */
export function getQueueEvents(queueName: string): QueueEvents | null {
  const connection = getBullConnection();
  if (!connection) return null;

  if (!queueEventsByName.has(queueName)) {
    const qe = new QueueEvents(queueName, {
      connection: connection.duplicate(),
    });
    queueEventsByName.set(queueName, qe);
  }

  if (!cleanupRegistered) {
    cleanupRegistered = true;
    const cleanup = () => void closeAllQueueEvents();
    process.once("SIGTERM", cleanup);
    process.once("SIGINT", cleanup);
    process.once("beforeExit", cleanup);
  }

  return queueEventsByName.get(queueName)!;
}

async function closeAllQueueEvents(): Promise<void> {
  const all = Array.from(queueEventsByName.values());
  queueEventsByName.clear();
  await Promise.all(all.map((qe) => qe.close().catch(() => {})));
}
