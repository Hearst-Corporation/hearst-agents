export const dynamic = "force-dynamic";

import Link from "next/link";
import { AlertingSettings } from "@/app/(user)/components/settings/alerting/AlertingSettings";

export default async function AlertingPage() {
  return (
    <div className="min-h-screen w-full bg-black text-white overflow-y-auto px-6 py-10">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors mb-8"
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
          Réglages
        </Link>

        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Alerting</h1>
          <p className="mt-1 text-sm text-white/50">Webhooks · Email · Slack · Signal types</p>
        </div>

        <AlertingSettings />
      </div>
    </div>
  );
}
