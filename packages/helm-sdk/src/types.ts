// ─── Core types ──────────────────────────────────────────────────────────────

export interface Run {
  id: string;
  kind: string;
  status: "pending" | "running" | "completed" | "failed" | string;
  output?: unknown;
  createdAt: string;
}

export interface MemoryResult {
  sourceId: string;
  textExcerpt: string;
  similarity: number;
  metadata?: Record<string, unknown>;
}

// ─── Chat ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatInput {
  message: string;
  conversationId?: string;
  history?: ChatMessage[];
}

export interface ChatResult {
  text: string;
  runId?: string;
}

// ─── Swarm ───────────────────────────────────────────────────────────────────

export interface SwarmKickoffInput {
  swarmId: string;
  context?: Record<string, unknown>;
}

export interface SwarmKickoffResult {
  runId: string;
  swarmName: string;
  status: string;
}

// ─── Memory ──────────────────────────────────────────────────────────────────

export interface MemorySearchInput {
  query: string;
  limit?: number;
}

// ─── Runs ────────────────────────────────────────────────────────────────────

export interface RunsListOptions {
  limit?: number;
  kind?: string;
}

// ─── Client ──────────────────────────────────────────────────────────────────

export interface HelmClientOptions {
  apiKey: string;
  baseUrl?: string;
  /** Request timeout in ms. Default: 30 000. Chat (streaming) ignores this. */
  timeout?: number;
}

export interface HelmClient {
  chat(input: ChatInput, onDelta?: (text: string) => void): Promise<ChatResult>;

  swarm: {
    kickoff(input: SwarmKickoffInput): Promise<SwarmKickoffResult>;
    status(runId: string): Promise<Run>;
  };

  memory: {
    search(input: MemorySearchInput): Promise<MemoryResult[]>;
  };

  runs: {
    list(opts?: RunsListOptions): Promise<Run[]>;
    get(id: string): Promise<Run | null>;
  };
}
