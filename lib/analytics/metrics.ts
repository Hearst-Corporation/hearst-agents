/**
 * Integration & Tool Metrics — computed from existing traces.
 *
 * Provides per-tool and per-agent statistics:
 * success rate, average latency, average cost, usage frequency.
 * All computed from raw trace data, no materialized views.
 */

export interface ToolMetrics {
  tool_name: string;
  total_calls: number;
  successful: number;
  failed: number;
  timed_out: number;
  success_rate: number;
  avg_latency_ms: number;
  p95_latency_ms: number;
  total_cost_usd: number;
  avg_cost_usd: number;
  failure_breakdown: Record<string, number>;
  last_used: string | null;
}
