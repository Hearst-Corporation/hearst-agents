/**
 * Composio adapter — Types.
 *
 * Composio (https://composio.dev) ships ~1500 pre-built agent actions across
 * 250+ providers, exposed as JSON-schema'd functions a tool-calling LLM can
 * invoke directly. We sit on top via a thin adapter so the rest of the
 * codebase never has to know about Composio specifics.
 */

export interface ComposioCallParams {
  /** The Composio action slug, e.g. "GMAIL_SEND_EMAIL". */
  action: string;
  /**
   * Composio's per-user identifier (their "entityId"). We pass our own
   * user_id so each user's connected accounts map to their actions.
   */
  entityId: string;
  /** Action-specific params (matches Composio's input schema for this action). */
  params: Record<string, unknown>;
}

export type ComposioErrorCode =
  | "NOT_CONFIGURED"
  | "SDK_NOT_INSTALLED"
  | "AUTH_REQUIRED"
  | "ACTION_FAILED"
  | "UNKNOWN_SLUG"
  | "TIMEOUT"
  | "UNKNOWN";

export interface ComposioResult {
  ok: boolean;
  data?: unknown;
  error?: string;
  errorCode?: ComposioErrorCode;
}

/**
 * Types partagés entre connections et discovery pour casser le cycle.
 */

export interface ConnectedAccount {
  id: string;
  appName: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface InitiateConnectionResult {
  ok: boolean;
  redirectUrl?: string | null;
  connectionId?: string;
  error?: string;
  errorCode?:
    | "NOT_CONFIGURED"
    | "NO_INTEGRATION"
    | "AUTH_CONFIG_REQUIRED"
    | "INVALID_INPUT"
    | "UPSTREAM_ERROR"
    | "UNKNOWN";
  details?: unknown;
}

export interface DiscoveredTool {
  /** Composio tool slug, e.g. "GMAIL_SEND_EMAIL". Stable identifier. */
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  /** Toolkit slug this tool belongs to. */
  app: string;
}
