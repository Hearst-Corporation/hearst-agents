"use client";

/**
 * Sub-rail Stage "meeting" — action items extraits du transcript +
 * mention Composio pour les missions templates.
 */

import { useStageData } from "@/stores/stage-data";
import { EmptyHint, Section } from "./Section";

export function ContextRailForMeeting() {
  const { actionItems, status } = useStageData((s) => s.meeting);
  return (
    <div className="h-full overflow-y-auto">
      <Section label="Action Items" count={actionItems.length}>
        {actionItems.length === 0 ? (
          <EmptyHint>{status ? "Analysis running…" : "Waiting for transcript"}</EmptyHint>
        ) : (
          <ul className="flex flex-col gap-3">
            {actionItems.map((item, i) => (
              <li key={i} className="border-l border-[var(--accent-teal-border)] pl-4 py-1">
                <p className="t-13 font-light text-text-soft truncate mb-1">{item.action}</p>
                {(item.owner || item.deadline) && (
                  <p className="t-9 font-medium text-text-ghost">
                    {[item.owner, item.deadline].filter(Boolean).join(" · ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section label="Mission templates">
        <p className="t-13 font-light text-text-faint leading-relaxed">
          Approve all → Composio execution (Slack, Linear, Notion, Gmail).
        </p>
      </Section>
    </div>
  );
}
