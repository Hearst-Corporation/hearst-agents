"use client";

/**
 * Section "Email" — destinataires, signaux, toggle, test.
 */

import type { Dispatch } from "react";
import type { AlertingPreferences } from "@/lib/notifications/schema";
import { parseEmailInput } from "./helpers";
import { Btn, Card, Input, SectionTitle, TestBadge, Toggle } from "./primitives";
import type { Action, SignalType, State } from "./types";

interface Props {
  prefs: AlertingPreferences;
  state: State;
  dispatch: Dispatch<Action>;
  onTest: (channel: "webhook" | "slack" | "email", targetIndex?: number) => Promise<void>;
}

export function EmailSection({ prefs, state, dispatch, onTest }: Props) {
  const handleEmailToggle = (enabled: boolean) => {
    if (enabled) {
      if (!prefs.email) {
        dispatch({
          type: "SET_PREFS",
          prefs: {
            ...prefs,
            email: { recipients: [], signalTypes: ["*"] },
          },
        });
      }
    } else {
      dispatch({ type: "SET_PREFS", prefs: { ...prefs, email: undefined } });
    }
  };

  const handleEmailRecipientsBlur = () => {
    const emails = parseEmailInput(state.emailInputRaw);
    if (emails.length > 0) {
      dispatch({
        type: "SET_PREFS",
        prefs: {
          ...prefs,
          email: {
            signalTypes: prefs.email?.signalTypes ?? ["*"],
            recipients: emails,
          },
        },
      });
    }
  };

  return (
    <section>
      <SectionTitle>Email</SectionTitle>
      <Card>
        <div className="flex flex-col gap-4">
          <Toggle
            checked={!!prefs.email}
            onChange={handleEmailToggle}
            label="Activer les alertes email"
          />

          {prefs.email && (
            <>
              <div>
                <label className="t-9 block mb-2" style={{ color: "var(--text-muted)" }}>
                  Destinataires (séparés par virgule)
                </label>
                <Input
                  value={state.emailInputRaw}
                  onChange={(v) => dispatch({ type: "SET_EMAIL_INPUT", raw: v })}
                  placeholder="alice@example.com, bob@example.com"
                  type="text"
                />
                <div className="flex flex-wrap gap-1 mt-2" onBlur={handleEmailRecipientsBlur}>
                  {prefs.email.recipients.map((r) => (
                    <span
                      key={r}
                      className="t-9"
                      style={{
                        background: "var(--surface-1)",
                        color: "var(--text-soft)",
                        border: "1px solid var(--border-default)",
                        borderRadius: "var(--radius-xs)",
                        padding: "1px var(--space-2)",
                      }}
                    >
                      {r}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  className="t-9 mt-1"
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--accent-teal)",
                    cursor: "pointer",
                    padding: 0,
                    letterSpacing: "var(--tracking-caption)",
                  }}
                  onClick={handleEmailRecipientsBlur}
                >
                  Valider les adresses
                </button>
              </div>

              <div>
                <label className="t-9 block mb-2" style={{ color: "var(--text-muted)" }}>
                  Signaux déclencheurs
                </label>
                <div className="flex flex-wrap gap-2">
                  <label
                    className="flex items-center gap-1 t-13"
                    style={{ color: "var(--text-soft)", cursor: "pointer" }}
                  >
                    <input
                      type="checkbox"
                      checked={prefs.email.signalTypes.includes("*")}
                      onChange={(e) => {
                        const types: SignalType[] = e.target.checked ? ["*"] : [];
                        dispatch({
                          type: "SET_PREFS",
                          prefs: { ...prefs, email: { ...prefs.email!, signalTypes: types } },
                        });
                      }}
                      style={{ accentColor: "var(--accent-teal)" }}
                    />
                    Tous les signaux critiques
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <TestBadge state={state.testStates.email} message={state.testMessages.email} />
                <Btn
                  onClick={() => onTest("email")}
                  disabled={
                    state.testStates.email === "testing" || prefs.email.recipients.length === 0
                  }
                >
                  Tester l&apos;envoi
                </Btn>
              </div>
            </>
          )}
        </div>
      </Card>
    </section>
  );
}
