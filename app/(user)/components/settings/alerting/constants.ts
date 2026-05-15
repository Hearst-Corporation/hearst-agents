/**
 * Mapping sévérité par signal business.
 */

import type { BUSINESS_SIGNAL_TYPES } from "@/lib/reports/signals/types";

export const SIGNAL_SEVERITY: Record<
  (typeof BUSINESS_SIGNAL_TYPES)[number],
  "critical" | "warning" | "info"
> = {
  mrr_drop: "critical",
  runway_risk: "critical",
  expense_spike: "critical",
  sla_breach: "critical",
  retention_drop: "critical",
  change_failure_high: "critical",
  incident_spike: "critical",
  pipeline_thin: "warning",
  cycle_time_drift: "warning",
  customer_at_risk: "warning",
  support_overload: "warning",
  feature_adoption_low: "warning",
  nps_decline: "warning",
  csat_drop: "warning",
  commit_velocity_drop: "warning",
  calendar_overload: "warning",
  auth_expiring: "warning",
  lead_time_drift: "warning",
  burnout_risk: "warning",
  meeting_overload: "warning",
  mrr_spike: "info",
};
