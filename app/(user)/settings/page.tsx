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
    <div
      className="min-h-screen w-full overflow-y-auto"
      style={{
        background: "var(--surface)",
        color: "var(--text)",
        padding: "var(--space-10) var(--space-6)",
      }}
    >
      <div style={{ maxWidth: "var(--width-center-max, 56rem)", margin: "0 auto" }}>
        <div style={{ marginBottom: "var(--space-8)" }}>
          <h1
            className="t-24"
            style={{
              fontWeight: "var(--ct-font-weight-semibold, 600)",
              letterSpacing: "var(--tracking-tight)",
              color: "var(--text)",
            }}
          >
            Réglages
          </h1>
          <p className="t-13" style={{ marginTop: "var(--space-1)", color: "var(--text-muted)" }}>
            Préférences, alerting, profil
          </p>
        </div>

        <div className="flex flex-col" style={{ gap: "var(--space-3)" }}>
          {sections.map((section) => {
            const inner = (
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center" style={{ gap: "var(--space-2)" }}>
                    <span
                      className="t-13"
                      style={{
                        fontWeight: "var(--ct-font-weight-medium, 500)",
                        color: "var(--text)",
                      }}
                    >
                      {section.label}
                    </span>
                    {section.disabled && (
                      <span
                        className="t-10"
                        style={{
                          fontWeight: "var(--ct-font-weight-medium, 500)",
                          padding: "var(--space-0-5) var(--space-1-5)",
                          borderRadius: "var(--ct-radius-sm, var(--radius-sm))",
                          background: "var(--surface-2)",
                          color: "var(--text-faint)",
                          textTransform: "uppercase",
                          letterSpacing: "var(--tracking-wide)",
                        }}
                      >
                        Bientôt
                      </span>
                    )}
                  </div>
                  <p
                    className="t-11"
                    style={{ marginTop: "var(--space-0-5)", color: "var(--text-faint)" }}
                  >
                    {section.description}
                  </p>
                </div>
                {!section.disabled && (
                  <svg
                    style={{ color: "var(--text-faint)" }}
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
                  style={{
                    border: "1px solid var(--border-default)",
                    borderRadius: "var(--ct-radius-lg, var(--radius-md))",
                    padding: "var(--space-4)",
                    opacity: 0.5,
                    cursor: "not-allowed",
                  }}
                >
                  {inner}
                </div>
              );
            }

            return (
              <Link
                key={section.label}
                href={section.href}
                style={{
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--ct-radius-lg, var(--radius-md))",
                  padding: "var(--space-4)",
                  display: "block",
                  transition: `border-color var(--duration-base) var(--ease-standard)`,
                  color: "inherit",
                  textDecoration: "none",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.borderColor =
                    "var(--border-strong, var(--border-default))";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.borderColor =
                    "var(--border-default)";
                }}
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
