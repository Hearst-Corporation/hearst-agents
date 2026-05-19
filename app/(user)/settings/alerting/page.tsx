export const dynamic = "force-dynamic";

import Link from "next/link";
import { AlertingSettings } from "@/app/(user)/components/settings/alerting/AlertingSettings";

export default async function AlertingPage() {
  return (
    <div
      className="min-h-screen w-full overflow-y-auto"
      style={{
        background: "var(--surface)",
        color: "var(--text)",
        padding: "var(--space-10) var(--space-6)",
      }}
    >
      <div style={{ maxWidth: "var(--width-center-max, 56rem)", margin: "0 auto" }}>
        <Link
          href="/settings"
          className="inline-flex items-center"
          style={{
            gap: "var(--space-1-5)",
            color: "var(--text-faint)",
            textDecoration: "none",
            marginBottom: "var(--space-8)",
            transition: `color var(--duration-base) var(--ease-standard)`,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-soft)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-faint)";
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path
              d="M9 2L4 7l5 5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="t-11">Réglages</span>
        </Link>

        <div style={{ marginBottom: "var(--space-8)" }}>
          <h1
            className="t-24"
            style={{
              fontWeight: "var(--ct-font-weight-semibold, 600)",
              letterSpacing: "var(--tracking-tight)",
              color: "var(--text)",
            }}
          >
            Alerting
          </h1>
          <p className="t-13" style={{ marginTop: "var(--space-1)", color: "var(--text-muted)" }}>
            Webhooks · Email · Slack · Signal types
          </p>
        </div>

        <AlertingSettings />
      </div>
    </div>
  );
}
