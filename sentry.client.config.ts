import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

function redactPayload(data: unknown): unknown {
  if (typeof data !== "object" || !data) return data;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    if (/prompt|system|message|content|email|token|secret|key/i.test(k)) {
      out[k] = "[REDACTED]";
    } else {
      out[k] = v;
    }
  }
  return out;
}

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    sendDefaultPii: false,
    // Pas de session replay en continu — uniquement sur erreur, échantillonné.
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: 0.1,
    enableLogs: true,
    debug: false,
    beforeSend(event) {
      // Strip headers sensibles
      if (event.request?.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
        delete event.request.headers["x-api-key"];
      }
      // Redact body (emails / tokens / secrets / contenus LLM)
      if (event.request?.data) {
        event.request.data = redactPayload(event.request.data);
      }
      // Scrub emails dans le message d'erreur
      if (event.message) {
        event.message = event.message.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[REDACTED_EMAIL]");
      }
      // Strip contextes LLM (system prompt, messages)
      if (event.contexts?.llm) {
        event.contexts.llm = { redacted: true };
      }
      return event;
    },
  });
}
