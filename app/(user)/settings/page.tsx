"use client";

import Link from "next/link";
import { StandalonePageFrame } from "@/app/(user)/components/standalone/StandalonePageFrame";
import { PanelCard, ScreenShell } from "@/app/(user)/components/ui";

const sections: Array<
  | { label: string; description: string; disabled: true; href: null }
  | { label: string; description: string; disabled: false; href: string }
> = [
  {
    label: "Alerting",
    href: "/settings/alerting",
    description: "Seuils, canaux, règles",
    disabled: false,
  },
  {
    label: "Profil",
    href: null,
    description: "Identité, préférences",
    disabled: true,
  },
  {
    label: "Tenant",
    href: null,
    description: "Espace de travail",
    disabled: true,
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
          {sections.map((section) => {
            const inner = (
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center" style={{ gap: "var(--space-2)" }}>
                    <span className="t-13 font-medium text-text">{section.label}</span>
                    {section.disabled && (
                      <span
                        className="t-9 font-medium uppercase text-text-ghost rounded"
                        style={{
                          padding: "var(--space-0-5) var(--space-1-5)",
                          background: "var(--surface-2)",
                          letterSpacing: "var(--tracking-label)",
                        }}
                      >
                        Bientôt
                      </span>
                    )}
                  </div>
                  <p
                    className="t-11 font-light text-text-faint"
                    style={{ marginTop: "var(--space-0-5)" }}
                  >
                    {section.description}
                  </p>
                </div>
                {!section.disabled && (
                  <span className="text-text-ghost shrink-0">
                    <ChevronRight />
                  </span>
                )}
              </div>
            );

            if (section.disabled) {
              return (
                <PanelCard key={section.label} className="opacity-50 cursor-not-allowed">
                  {inner}
                </PanelCard>
              );
            }

            return (
              <Link key={section.label} href={section.href} className="block">
                <PanelCard hover>{inner}</PanelCard>
              </Link>
            );
          })}
        </div>
      </ScreenShell>
    </StandalonePageFrame>
  );
}
