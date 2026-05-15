/**
 * HttpAdapter — generic HTTP fetch integration (read-only Phase 1).
 *
 * Action: http.fetch — performs a GET request to an arbitrary URL.
 * Auth: supports bearer token and API key header injection.
 * Safety: read-only (GET only), timeout enforced, no secrets in output.
 */

import { assertSafeUrl, SsrfBlockedError } from "@/lib/security/ssrf-guard";
import type {
  AdapterAction,
  AdapterResult,
  IntegrationAdapter,
  IntegrationCredentials,
} from "./adapter";

const HTTP_FETCH_ACTION: AdapterAction = {
  name: "http.fetch",
  description: "Fetch data from an HTTP endpoint (GET only, read-only)",
  readonly: true,
  input_schema: {
    type: "object",
    properties: {
      url: { type: "string", description: "URL to fetch" },
      headers: { type: "object", description: "Additional headers (optional)" },
    },
    required: ["url"],
  },
  output_schema: {
    type: "object",
    properties: {
      status: { type: "number" },
      content_type: { type: "string" },
      data: { description: "Response body (JSON or text)" },
      truncated: { type: "boolean" },
    },
  },
};

const MAX_RESPONSE_SIZE = 100_000;
const DEFAULT_TIMEOUT_MS = 15_000;

export class HttpAdapter implements IntegrationAdapter {
  readonly provider = "http";
  readonly actions = [HTTP_FETCH_ACTION];

  async execute(
    action: string,
    input: Record<string, unknown>,
    credentials: IntegrationCredentials,
  ): Promise<AdapterResult> {
    if (action !== "http.fetch") {
      return {
        success: false,
        data: null,
        status: 0,
        latency_ms: 0,
        error: `Unknown action: ${action}`,
      };
    }

    const url = input.url as string | undefined;
    if (!url) {
      return {
        success: false,
        data: null,
        status: 0,
        latency_ms: 0,
        error: "Missing required field: url",
      };
    }

    // SSRF guard : DNS lookup avant fetch (rebinding protection)
    let safeUrl: URL;
    try {
      safeUrl = await assertSafeUrl(url);
    } catch (err) {
      const reason = err instanceof SsrfBlockedError ? err.reason : "ssrf_blocked";
      return {
        success: false,
        data: null,
        status: 0,
        latency_ms: 0,
        error: `SSRF guard: ${reason}`,
      };
    }

    // Domaine attendu pour l'intégration — les credentials ne sont envoyés
    // QUE si le host résolu correspond à celui configuré dans les credentials.
    // Cela empêche l'exfiltration de tokens vers un hôte malveillant.
    const credentialHost = (credentials as Record<string, unknown>).expected_host as
      | string
      | undefined;
    const hostMatches = !credentialHost || safeUrl.hostname === credentialHost;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    const start = Date.now();

    try {
      const headers: Record<string, string> = {
        "User-Agent": "Hearst-Agent/1.0",
        ...((input.headers as Record<string, string>) ?? {}),
      };

      // N'attache les credentials QUE si le host est celui attendu
      if (hostMatches) {
        if (credentials.bearer_token) {
          headers.Authorization = `Bearer ${credentials.bearer_token}`;
        } else if (credentials.api_key) {
          headers.Authorization = `Bearer ${credentials.api_key}`;
        }
      }

      const res = await fetch(safeUrl.toString(), {
        method: "GET",
        headers,
        signal: controller.signal,
        redirect: "manual",
      });

      // Bloque les redirects (302 vers IP privée bypass le guard initial)
      if (res.status >= 300 && res.status < 400) {
        return {
          success: false,
          data: null,
          status: res.status,
          latency_ms: Date.now() - start,
          error: "redirect_not_allowed",
        };
      }

      const contentType = res.headers.get("content-type") ?? "";
      let data: unknown;
      let truncated = false;

      if (contentType.includes("application/json")) {
        const text = await res.text();
        if (text.length > MAX_RESPONSE_SIZE) {
          data = text.slice(0, MAX_RESPONSE_SIZE);
          truncated = true;
        } else {
          try {
            data = JSON.parse(text);
          } catch {
            data = text;
          }
        }
      } else {
        const text = await res.text();
        if (text.length > MAX_RESPONSE_SIZE) {
          data = text.slice(0, MAX_RESPONSE_SIZE);
          truncated = true;
        } else {
          data = text;
        }
      }

      const latency = Date.now() - start;

      return {
        success: res.ok,
        data: { status: res.status, content_type: contentType, data, truncated },
        status: res.status,
        latency_ms: latency,
        error: res.ok ? undefined : `HTTP ${res.status}`,
      };
    } catch (e) {
      const latency = Date.now() - start;
      const msg = e instanceof Error ? e.message : String(e);
      return {
        success: false,
        data: null,
        status: 0,
        latency_ms: latency,
        error: msg.includes("abort") ? `Timeout after ${DEFAULT_TIMEOUT_MS}ms` : msg,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async healthCheck(credentials: IntegrationCredentials): Promise<{
    healthy: boolean;
    latency_ms: number;
    error?: string;
  }> {
    const start = Date.now();
    try {
      const headers: Record<string, string> = {};
      if (credentials.bearer_token) {
        headers.Authorization = `Bearer ${credentials.bearer_token}`;
      }

      const res = await fetch("https://httpstat.us/200", {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(5000),
      });

      return { healthy: res.ok, latency_ms: Date.now() - start };
    } catch (e) {
      return {
        healthy: false,
        latency_ms: Date.now() - start,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }
}
