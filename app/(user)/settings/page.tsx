"use client";

import Link from "next/link";
import { StandalonePageFrame } from "@/app/(user)/components/standalone/StandalonePageFrame";
import { PanelCard, ScreenShell } from "@/app/(user)/components/ui";

const sections: Array<{ label: string; description: string; href: string }> = [
  {
    label: "Alerting",
    href: "/settings/alerting",
    description: "Seuils, canaux, règles",
  },
];

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M6 3l5 5-5 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function SettingsPage() {
  return (
    <StandalonePageFrame>
      <ScreenShell title="Réglages" subtitle="Préférences, alerting, profil">
        <div
          className="flex flex-col"
          style={{ gap: "var(--space-3)", maxWidth: "var(--width-center-max)" }}
        >
          {sections.map((section) => (
            <Link key={section.label} href={section.href} className="block">
              <PanelCard hover>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="t-13 font-medium text-text">{section.label}</span>
                    <p
                      className="t-11 font-light text-text-faint"
                      style={{ marginTop: "var(--space-0-5)" }}
                    >
                      {section.description}
                    </p>
                  </div>
                  <span className="text-text-ghost shrink-0">
                    <ChevronRight />
                  </span>
                </div>
              </PanelCard>
            </Link>
          ))}
        </div>
      </ScreenShell>
    </StandalonePageFrame>
  );
}
