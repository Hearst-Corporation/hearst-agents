export const dynamic = "force-dynamic";

import Link from "next/link";

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

export default async function SettingsPage() {
  return (
    <div className="min-h-screen w-full bg-black text-white overflow-y-auto px-6 py-10">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Réglages</h1>
          <p className="mt-1 text-sm text-white/50">Préférences, alerting, profil</p>
        </div>

        <div className="flex flex-col gap-3">
          {sections.map((section) => {
            const inner = (
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{section.label}</span>
                    {section.disabled && (
                      <span className="t-10 font-medium px-1.5 py-0.5 rounded bg-white/10 text-white/40 uppercase tracking-wide">
                        Bientôt
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-white/40">{section.description}</p>
                </div>
                {!section.disabled && (
                  <svg
                    className="text-white/30"
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M6 3l5 5-5 5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
            );

            if (section.disabled) {
              return (
                <div
                  key={section.label}
                  className="border border-white/10 rounded-xl p-4 opacity-50 cursor-not-allowed"
                >
                  {inner}
                </div>
              );
            }

            return (
              <Link
                key={section.label}
                href={section.href}
                className="border border-white/10 rounded-xl p-4 hover:border-white/20 transition-colors"
              >
                {inner}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
