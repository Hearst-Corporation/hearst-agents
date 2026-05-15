"use client";

/**
 * Section "Webhooks" — liste, ajout, suppression et test.
 */

import type { Dispatch } from "react";
import type { AlertingPreferences } from "@/lib/notifications/schema";
import { BUSINESS_SIGNAL_TYPES } from "@/lib/reports/signals/types";
import { Btn, Card, Input, SectionTitle, SignalBadge, TestBadge } from "./primitives";
import type { Action, SignalType, State } from "./types";

const MAX_WEBHOOKS = 10;

interface Props {
  prefs: AlertingPreferences;
  state: State;
  dispatch: Dispatch<Action>;
  onTest: (channel: "webhook" | "slack" | "email", targetIndex?: number) => Promise<void>;
}

export function WebhooksSection({ prefs, state, dispatch, onTest }: Props) {
  return (
    <section>
      <SectionTitle>Webhooks</SectionTitle>

      {prefs.webhooks.length === 0 && !state.showNewWebhookForm && (
        <p className="t-13" style={{ color: "var(--text-faint)", marginBottom: "var(--space-3)" }}>
          Aucun webhook configuré.
        </p>
      )}

      {prefs.webhooks.map((wh, idx) => (
        <Card key={idx}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p
                className="t-13"
                style={{
                  color: "var(--text-soft)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontFamily: "monospace",
                }}
              >
                {wh.url}
              </p>
              <div className="flex flex-wrap gap-1 mt-2">
                {wh.signalTypes.map((st) => (
                  <SignalBadge key={st} type={st} />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <TestBadge
                state={state.testStates[`webhook-${idx}`]}
                message={state.testMessages[`webhook-${idx}`]}
              />
              <Btn
                onClick={() => onTest("webhook", idx)}
                disabled={state.testStates[`webhook-${idx}`] === "testing"}
              >
                Tester
              </Btn>
              <Btn
                variant="danger"
                onClick={() => dispatch({ type: "REMOVE_WEBHOOK", index: idx })}
              >
                Supprimer
              </Btn>
            </div>
          </div>
        </Card>
      ))}

      {state.showNewWebhookForm && (
        <Card>
          <div className="flex flex-col gap-3">
            <label className="t-9" style={{ color: "var(--text-muted)" }}>
              URL du webhook
            </label>
            <Input
              value={state.newWebhook.url}
              onChange={(v) => dispatch({ type: "NEW_WEBHOOK_CHANGE", draft: { url: v } })}
              placeholder="https://hook.example.com/abc"
              type="url"
            />

            <label
              className="t-11 font-medium"
              style={{ color: "var(--text-l2)", marginTop: "var(--space-2)" }}
            >
              Signaux déclencheurs
            </label>
            <div className="flex flex-wrap gap-2">
              <label
                className="flex items-center gap-1 t-13"
                style={{ color: "var(--text-soft)", cursor: "pointer" }}
              >
                <input
                  type="checkbox"
                  checked={state.newWebhook.signalTypes.includes("*")}
                  onChange={(e) => {
                    const types: SignalType[] = e.target.checked
                      ? ["*"]
                      : state.newWebhook.signalTypes.filter((s) => s !== "*");
                    dispatch({ type: "NEW_WEBHOOK_CHANGE", draft: { signalTypes: types } });
                  }}
                  style={{ accentColor: "var(--accent-teal)" }}
                />
                Tous les signaux
              </label>
              {!state.newWebhook.signalTypes.includes("*") &&
                BUSINESS_SIGNAL_TYPES.map((st) => (
                  <label
                    key={st}
                    className="flex items-center gap-1 t-13"
                    style={{ color: "var(--text-soft)", cursor: "pointer" }}
                  >
                    <input
                      type="checkbox"
                      checked={state.newWebhook.signalTypes.includes(st)}
                      onChange={(e) => {
                        const types: SignalType[] = e.target.checked
                          ? [...state.newWebhook.signalTypes, st]
                          : state.newWebhook.signalTypes.filter((s) => s !== st);
                        dispatch({ type: "NEW_WEBHOOK_CHANGE", draft: { signalTypes: types } });
                      }}
                      style={{ accentColor: "var(--accent-teal)" }}
                    />
                    {st}
                  </label>
                ))}
            </div>

            <div className="flex gap-2 mt-2">
              <Btn
                variant="primary"
                onClick={() => dispatch({ type: "ADD_WEBHOOK" })}
                disabled={!state.newWebhook.url.startsWith("http")}
              >
                Ajouter
              </Btn>
              <Btn
                variant="ghost"
                onClick={() => dispatch({ type: "SHOW_NEW_WEBHOOK", show: false })}
              >
                Annuler
              </Btn>
            </div>
          </div>
        </Card>
      )}

      {!state.showNewWebhookForm && prefs.webhooks.length < MAX_WEBHOOKS && (
        <Btn onClick={() => dispatch({ type: "SHOW_NEW_WEBHOOK", show: true })}>
          + Ajouter un webhook
        </Btn>
      )}
    </section>
  );
}
