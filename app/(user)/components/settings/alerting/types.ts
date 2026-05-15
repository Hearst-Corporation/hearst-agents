/**
 * Types locaux + reducer pour `AlertingSettings`.
 */

import type { AlertingPreferences } from "@/lib/notifications/schema";
import type { BUSINESS_SIGNAL_TYPES } from "@/lib/reports/signals/types";

export type SignalType = (typeof BUSINESS_SIGNAL_TYPES)[number] | "*";

export interface WebhookDraft {
  url: string;
  signalTypes: SignalType[];
}

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export type TestState = "testing" | "ok" | "error";

export interface State {
  prefs: AlertingPreferences;
  loading: boolean;
  saveStatus: SaveStatus;
  saveError: string | null;
  /** Formulaire webhook en cours d'ajout */
  newWebhook: WebhookDraft;
  showNewWebhookForm: boolean;
  /** Tests en cours { key → "testing" | "ok" | "error" } */
  testStates: Record<string, TestState>;
  testMessages: Record<string, string>;
  /** Email input brut (tags) */
  emailInputRaw: string;
}

export type Action =
  | { type: "LOADED"; prefs: AlertingPreferences }
  | { type: "LOAD_ERROR" }
  | { type: "SAVE_START" }
  | { type: "SAVE_OK"; prefs: AlertingPreferences }
  | { type: "SAVE_ERROR"; message: string }
  | { type: "SET_PREFS"; prefs: AlertingPreferences }
  | { type: "NEW_WEBHOOK_CHANGE"; draft: Partial<WebhookDraft> }
  | { type: "SHOW_NEW_WEBHOOK"; show: boolean }
  | { type: "ADD_WEBHOOK" }
  | { type: "REMOVE_WEBHOOK"; index: number }
  | { type: "TEST_START"; key: string }
  | { type: "TEST_DONE"; key: string; ok: boolean; message: string }
  | { type: "SET_EMAIL_INPUT"; raw: string };

export const INITIAL_STATE: State = {
  prefs: { webhooks: [] },
  loading: true,
  saveStatus: "idle",
  saveError: null,
  newWebhook: { url: "", signalTypes: ["*"] },
  showNewWebhookForm: false,
  testStates: {},
  testMessages: {},
  emailInputRaw: "",
};

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "LOADED":
      return {
        ...state,
        loading: false,
        prefs: action.prefs,
        emailInputRaw: action.prefs.email?.recipients.join(", ") ?? "",
      };
    case "LOAD_ERROR":
      return { ...state, loading: false };
    case "SAVE_START":
      return { ...state, saveStatus: "saving", saveError: null };
    case "SAVE_OK":
      return { ...state, saveStatus: "saved", prefs: action.prefs };
    case "SAVE_ERROR":
      return { ...state, saveStatus: "error", saveError: action.message };
    case "SET_PREFS":
      return { ...state, prefs: action.prefs };
    case "NEW_WEBHOOK_CHANGE":
      return {
        ...state,
        newWebhook: { ...state.newWebhook, ...action.draft },
      };
    case "SHOW_NEW_WEBHOOK":
      return {
        ...state,
        showNewWebhookForm: action.show,
        newWebhook: action.show ? { url: "", signalTypes: ["*"] } : state.newWebhook,
      };
    case "ADD_WEBHOOK": {
      const webhooks = [
        ...state.prefs.webhooks,
        { url: state.newWebhook.url, signalTypes: state.newWebhook.signalTypes },
      ];
      return {
        ...state,
        prefs: { ...state.prefs, webhooks },
        showNewWebhookForm: false,
        newWebhook: { url: "", signalTypes: ["*"] },
      };
    }
    case "REMOVE_WEBHOOK": {
      const webhooks = state.prefs.webhooks.filter((_, i) => i !== action.index);
      return { ...state, prefs: { ...state.prefs, webhooks } };
    }
    case "TEST_START":
      return {
        ...state,
        testStates: { ...state.testStates, [action.key]: "testing" },
        testMessages: { ...state.testMessages, [action.key]: "" },
      };
    case "TEST_DONE":
      return {
        ...state,
        testStates: { ...state.testStates, [action.key]: action.ok ? "ok" : "error" },
        testMessages: { ...state.testMessages, [action.key]: action.message },
      };
    case "SET_EMAIL_INPUT":
      return { ...state, emailInputRaw: action.raw };
    default:
      return state;
  }
}
