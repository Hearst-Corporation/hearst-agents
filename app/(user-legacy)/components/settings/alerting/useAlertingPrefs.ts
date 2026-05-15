"use client";

/**
 * Hook : encapsule fetch initial, sauvegarde et test de canal pour AlertingSettings.
 */

import type { Dispatch } from "react";
import { useCallback, useEffect, useReducer } from "react";
import type { AlertingPreferences } from "@/lib/notifications/schema";
import { type Action, INITIAL_STATE, reducer, type State } from "./types";

interface UseAlertingPrefs {
  state: State;
  dispatch: Dispatch<Action>;
  handleSave: (prefs: AlertingPreferences) => Promise<void>;
  testChannel: (channel: "webhook" | "slack" | "email", targetIndex?: number) => Promise<void>;
}

export function useAlertingPrefs(): UseAlertingPrefs {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  // ── Chargement initial ─────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/settings/alerting")
      .then((r) => r.json())
      .then((data: { prefs?: AlertingPreferences }) => {
        if (data.prefs) {
          dispatch({ type: "LOADED", prefs: data.prefs });
        } else {
          dispatch({ type: "LOAD_ERROR" });
        }
      })
      .catch(() => dispatch({ type: "LOAD_ERROR" }));
  }, []);

  // ── Sauvegarde explicite ───────────────────────────────────────────────
  const handleSave = useCallback(async (prefs: AlertingPreferences) => {
    dispatch({ type: "SAVE_START" });
    try {
      const res = await fetch("/api/settings/alerting", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        prefs?: AlertingPreferences;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        dispatch({ type: "SAVE_ERROR", message: data.error ?? `HTTP ${res.status}` });
      } else {
        dispatch({ type: "SAVE_OK", prefs: data.prefs ?? prefs });
      }
    } catch (err) {
      dispatch({
        type: "SAVE_ERROR",
        message: err instanceof Error ? err.message : "Erreur réseau",
      });
    }
  }, []);

  // ── Test canal ─────────────────────────────────────────────────────────
  const testChannel = useCallback(
    async (channel: "webhook" | "slack" | "email", targetIndex?: number) => {
      const key = channel === "webhook" ? `webhook-${targetIndex ?? 0}` : channel;
      dispatch({ type: "TEST_START", key });
      try {
        const res = await fetch("/api/settings/alerting/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channel, targetIndex }),
        });
        const data = (await res.json()) as { ok?: boolean; result?: { error?: string } };
        const ok = res.ok && data.ok === true;
        const message = data.result?.error ?? (ok ? "Signal envoyé" : "Échec");
        dispatch({ type: "TEST_DONE", key, ok, message });
      } catch (err) {
        dispatch({
          type: "TEST_DONE",
          key,
          ok: false,
          message: err instanceof Error ? err.message : "Erreur réseau",
        });
      }
    },
    [],
  );

  return { state, dispatch, handleSave, testChannel };
}
