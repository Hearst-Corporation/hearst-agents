const CREWAI_ENGINE_URL = process.env.CREWAI_ENGINE_URL ?? "http://127.0.0.1:8000";
const CREWAI_API_KEY = process.env.CREWAI_API_KEY ?? "";

export interface CrewAIError extends Error {
  status?: number;
  body?: unknown;
}

export class CrewAIClient {
  constructor(
    private baseUrl: string = CREWAI_ENGINE_URL,
    private apiKey: string = CREWAI_API_KEY,
  ) {}

  private async request<T>(path: string, opts: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(opts.headers as Record<string, string>),
    };
    if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`;

    const res = await fetch(url, {
      ...opts,
      headers,
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const err: CrewAIError = new Error(`CrewAI ${path} HTTP ${res.status}`);
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return res.json() as Promise<T>;
  }

  health() {
    return this.request<{ status: string }>("/health");
  }

  listSwarms() {
    return this.request<{
      swarms: Array<{ id: string; name: string; description?: string }>;
    }>("/v1/swarms");
  }

  getSwarm(id: string) {
    return this.request(`/v1/swarms/${id}`);
  }

  createSwarm(body: unknown) {
    return this.request("/v1/swarms", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  updateSwarm(id: string, body: unknown) {
    return this.request(`/v1/swarms/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  }

  deleteSwarm(id: string) {
    return this.request(`/v1/swarms/${id}`, { method: "DELETE" });
  }

  kickoffSwarm(id: string, context: Record<string, unknown> = {}) {
    return this.request<{ run_id: string }>(`/v1/swarms/${id}/kickoff`, {
      method: "POST",
      body: JSON.stringify({ context }),
    });
  }

  getSwarmRun(swarmId: string, runId: string) {
    return this.request(`/v1/swarms/${swarmId}/status/${runId}`);
  }

  listSwarmRuns(swarmId: string) {
    return this.request(`/v1/swarms/${swarmId}/runs`);
  }

  getRun(runId: string) {
    return this.request(`/v1/runs/${runId}`);
  }

  generateSwarmFromBrief(brief: string) {
    return this.request("/v1/swarms/architect/generate", {
      method: "POST",
      body: JSON.stringify({ brief }),
    });
  }

  listTools() {
    return this.request<{
      tools: Array<{ name: string; description: string; category?: string }>;
    }>("/v1/tools");
  }

  // Chief of Staff
  kickoffChief(context: Record<string, unknown> = {}) {
    return this.request<{ kickoff_id: string }>("/crews/chief-of-staff/kickoff", {
      method: "POST",
      body: JSON.stringify({ context }),
    });
  }

  getChiefStatus(kickoffId: string) {
    return this.request(`/crews/chief-of-staff/status/${kickoffId}`);
  }

  listChiefRuns() {
    return this.request("/crews/chief-of-staff/runs");
  }

  getChiefSteps(kickoffId: string) {
    return this.request(`/crews/chief-of-staff/runs/${kickoffId}/steps`);
  }

  getChiefDecisions(kickoffId: string) {
    return this.request(`/crews/chief-of-staff/runs/${kickoffId}/decisions`);
  }

  postChiefDecision(body: { kickoff_id: string; decision: string; metadata?: unknown }) {
    return this.request("/crews/chief-of-staff/decisions", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }
}

export const crewai = new CrewAIClient();
