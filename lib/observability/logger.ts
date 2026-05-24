/**
 * Logger structuré pino — observabilité serveur.
 *
 * Pourquoi pino plutôt que console :
 *  - JSON structuré → parseable par Vercel logs / Datadog / Loki sans regex.
 *  - Redaction native des champs sensibles (tokens, cookies, headers auth)
 *    → pas de fuite de secrets dans les logs Vercel.
 *  - Niveau configurable via `LOG_LEVEL` (debug en dev, info+ en prod).
 *  - No-op safe : si l'env n'est pas configuré, pino tourne quand même
 *    (level par défaut "info"). Aucune erreur runtime.
 *
 * Usage :
 *   import { logger, withRoute, redactedError } from "@/lib/observability/logger";
 *   const log = withRoute("POST /api/v2/jobs/audio-gen");
 *   log.info({ jobId }, "job_enqueued");
 *   log.error({ err: redactedError(err) }, "enqueue_failed");
 *
 * Sentry side-by-side : ce logger ne remplace pas Sentry. Pour les erreurs
 * critiques, continuer à appeler `Sentry.captureException(err)`.
 */

import pino, { type Logger } from "pino";

const isProd = process.env.NODE_ENV === "production";
const isTest = process.env.NODE_ENV === "test";
const defaultLevel = isProd ? "info" : isTest ? "warn" : "debug";

/**
 * Champs systématiquement masqués dans les logs.
 *
 * Pino redact applique le pattern sur la structure des objets loggés.
 * `*.token` couvre les objets de type `{ slack: { token: "..." } }` ou
 * `{ tokens: { token: "..." } }` au premier niveau d'imbrication.
 */
const REDACT_PATHS = [
  "*.token",
  "*.access_token",
  "*.refresh_token",
  "*.password",
  "*.secret",
  "*.apiKey",
  "*.api_key",
  "*.authorization",
  "*.email",
  "*.phone",
  "token",
  "access_token",
  "refresh_token",
  "password",
  "secret",
  "apiKey",
  "api_key",
  "tokens.accessToken",
  "tokens.refreshToken",
  "req.headers.authorization",
  "req.headers.cookie",
  "headers.authorization",
  "headers.cookie",
];

/**
 * Logger racine. Format JSON en prod (parseable Vercel), pretty en dev.
 *
 * `pino-pretty` est uniquement chargé hors production, et via `transport`
 * qui ne casse pas si la dépendance n'est pas dispo (pino fallback JSON).
 */
function createLogger(): Logger {
  const baseOptions: pino.LoggerOptions = {
    level: process.env.LOG_LEVEL ?? defaultLevel,
    base: {
      env: process.env.NODE_ENV ?? "development",
      service: "hearst-os",
    },
    redact: {
      paths: REDACT_PATHS,
      censor: "[REDACTED]",
    },
    formatters: {
      level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  if (isProd) {
    return pino(baseOptions);
  }

  // Dev / test : tente pino-pretty, fallback silencieux sur JSON si indispo.
  try {
    return pino({
      ...baseOptions,
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss.l",
          ignore: "pid,hostname,env,service",
          singleLine: false,
        },
      },
    });
  } catch {
    return pino(baseOptions);
  }
}

export const logger: Logger = createLogger();

/**
 * Crée un child logger taggé par route. Tous les logs émis via le child
 * incluent automatiquement `{ route: "<name>" }`, ce qui permet de filtrer
 * dans Vercel/Datadog par endpoint sans grep.
 */
export function withRoute(name: string): Logger {
  return logger.child({ route: name });
}

/**
 * Sérialise une `Error` en objet log-safe, sans exposer la stack en prod.
 *
 * - En dev, on garde la stack pour faciliter le debug local.
 * - En prod, on retourne uniquement `{ name, message }` pour limiter la
 *   surface d'exposition (les stacks peuvent contenir des chemins serveur
 *   ou des fragments de payload).
 */
export function redactedError(err: unknown): {
  name: string;
  message: string;
  stack?: string;
} {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      ...(isProd ? {} : { stack: err.stack }),
    };
  }
  return {
    name: "UnknownError",
    message: typeof err === "string" ? err : JSON.stringify(err),
  };
}
