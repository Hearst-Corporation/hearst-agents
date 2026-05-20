/**
 * Wrapper fetch typé pour appeler Cortex depuis Helm.
 * Auto-inject le JWT, parse les erreurs proprement.
 */

const CORTEX_URL = process.env.CORTEX_URL ?? "https://cortex.hearst.app";

export class CortexClient {
  constructor(private token: string) {}

  private async request<T>(path: string, opts: RequestInit = {}): Promise<T> {
    const res = await fetch(`${CORTEX_URL}${path}`, {
      ...opts,
      headers: {
        ...opts.headers,
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      throw new Error(`Cortex ${path} → HTTP ${res.status}: ${await res.text().catch(() => "")}`);
    }
    return res.json() as Promise<T>;
  }

  async search(query: string, opts: { limit?: number; mode?: string } = {}) {
    return this.request<{
      count: number;
      results: Array<{
        path: string;
        title: string;
        score: number;
        content_preview: string;
      }>;
    }>("/api/search", {
      method: "POST",
      body: JSON.stringify({
        query,
        limit: opts.limit ?? 10,
        mode: opts.mode ?? "hybrid",
      }),
    });
  }

  async listProjects() {
    return this.request<{
      count: number;
      projects: Array<{ projet: string; count: number }>;
    }>("/api/projects");
  }

  async stats() {
    return this.request<{ points_count: number; indexed_count: number }>("/api/stats");
  }

  async streamToken(ttl_seconds = 900): Promise<{ token: string; expires_in: number }> {
    return this.request("/api/auth/token", {
      method: "POST",
      body: JSON.stringify({ tenant_id: "self", ttl_seconds }),
    });
  }
}

export function cortexClientFromRequest(_req: Request, token: string): CortexClient {
  return new CortexClient(token);
}
