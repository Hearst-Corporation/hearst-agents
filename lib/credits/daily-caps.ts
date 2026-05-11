/**
 * Daily cap enforcement via Redis.
 *
 * Chaque utilisateur a un quota par clé (daily-brief, simulations, kg-ingest, etc.)
 * réinitialisé tous les 24h minuit UTC.
 */

import { getRedis } from "@/lib/platform/redis/client";

export interface DailyCap {
  allowed: boolean;
  current: number;
  max: number;
}

/**
 * Vérifie et incrémente le compteur journalier pour un utilisateur.
 * Retourne { allowed, current, max }.
 */
export async function checkDailyCap(
  userId: string,
  key: string,
  max: number,
): Promise<DailyCap> {
  const redis = getRedis();
  if (!redis) {
    // Si Redis n'est pas disponible, fallback : permettre (dev mode)
    console.warn("[daily-caps] Redis unavailable, cap bypass");
    return {
      allowed: true,
      current: 1,
      max,
    };
  }

  // YYYY-MM-DD en UTC
  const date = new Date().toISOString().slice(0, 10);
  const redisKey = `daily-cap:${key}:${userId}:${date}`;

  try {
    const current = await redis.incr(redisKey);

    // TTL défini à la première utilisation du jour
    if (current === 1) {
      await redis.expire(redisKey, 86_400); // 24h
    }

    return {
      allowed: current <= max,
      current,
      max,
    };
  } catch (err) {
    console.error(`[daily-caps] Redis error for ${redisKey}:`, err);
    // Fallback gracieux : on refuse si Redis est en panne (protection)
    return {
      allowed: false,
      current: max + 1,
      max,
    };
  }
}
