"use client";

/**
 * Section "Slack" — webhook URL, toggle, test.
 */

import type { Dispatch } from "react";
import type { AlertingPreferences } from "@/lib/notifications/schema";
import { Btn, Card, Input, SectionTitle, TestBadge, Toggle } from "./primitives";
import type { Action, State } from "./types";

interface Props {
  prefs: AlertingPreferences;
  state: State;
  dispatch: Dispatch<Action>;
  onTest: (channel: "webhook" | "slack" | "email", targetIndex?: number) => Promise<void>;
}

export function SlackSection({ prefs, state, dispatch, onTest }: Props) {
  const handleSlackToggle = (enabled: boolean) => {
    if (enabled) {
      if (!prefs.slack) {
        dispatch({
          type: "SET_PREFS",
          prefs: {
            ...prefs,
            slack: { webhookUrl: "", signalTypes: ["*"] },
          },
        });
      }
    } else {
      dispatch({ type: "SET_PREFS", prefs: { ...prefs, slack: undefined } });
    }
  };

  return (
    <section>
      <SectionTitle>Slack</SectionTitle>
      <Card>
        <div className="flex flex-col gap-4">
          <Toggle
            checked={!!prefs.slack}
            onChange={handleSlackToggle}
            label="Activer les alertes Slack"
          />

          {prefs.slack && (
            <>
              <div>
                <label className="t-9 block mb-2" style={{ color: "var(--text-muted)" }}>
                  URL du webhook Slack
                </label>
                <Input
                  value={prefs.slack.webhookUrl}
                  onChange={(v) =>
                    dispatch({
                      type: "SET_PREFS",
                      prefs: { ...prefs, slack: { ...prefs.slack!, webhookUrl: v } },
                    })
                  }
                  placeholder="https://hooks.slack.com/services/T.../B.../..."
                  type="url"
                />
                <p className="t-9 mt-2" style={{ color: "var(--text-faint)" }}>
                  Pour obtenir une URL webhook : ouvrez Slack → Apps → Incoming Webhooks → Ajouter à
                  Slack.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <TestBadge state={state.testStates.slack} message={state.testMessages.slack} />
                <Btn
                  onClick={() => onTest("slack")}
                  disabled={
                    state.testStates.slack === "testing" ||
                    !prefs.slack.webhookUrl.startsWith("https://")
                  }
                >
                  Tester la connexion
                </Btn>
              </div>
            </>
          )}
        </div>
      </Card>
    </section>
  );
}
