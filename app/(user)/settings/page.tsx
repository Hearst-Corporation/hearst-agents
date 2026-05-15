/**
 * /settings — Hub des réglages utilisateur.
 *
 * Liste les sections disponibles (Alerting, et plus tard tenant, profil, etc.)
 * pour donner un point d'entrée unique et un breadcrumb cohérent depuis les
 * sous-pages /settings/*.
 */

import Link from "next/link";
import { PageHeader } from "@/app/(user)/components/PageHeader";

interface SettingsEntry {
  href: string;
  title: string;
  description: string;
}

const ENTRIES: SettingsEntry[] = [
  {
    href: "/settings/alerting",
    title: "Alerting",
    description: "Canaux de notification pour les signaux critiques.",
  },
];

export default function SettingsPage() {
  return (
    <div
      className="flex-1 flex flex-col min-h-0 overflow-y-auto panel-enter"
      style={{ background: "var(--bg-elev)" }}
    >
      <PageHeader
        title="Réglages"
        subtitle="Préférences et configuration globale."
        breadcrumb={[{ label: "Hearst", href: "/" }, { label: "Réglages" }]}
      />
      <div
        className="w-full px-12 py-6"
        style={{ maxWidth: "var(--width-center-max)", margin: "0 auto" }}
      >
        <ul className="flex flex-col" style={{ gap: "var(--space-2)" }}>
          {ENTRIES.map((entry) => (
            <li key={entry.href}>
              <Link
                href={entry.href}
                className="block px-6 py-4 border border-(--border-soft) rounded-md hover:border-[var(--accent-teal)] transition-colors"
              >
                <div className="t-15 font-medium text-text">{entry.title}</div>
                <div
                  className="t-13 font-light text-text-muted"
                  style={{ marginTop: "var(--space-1)" }}
                >
                  {entry.description}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
