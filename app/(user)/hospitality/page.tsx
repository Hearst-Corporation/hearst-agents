"use client";

/**
 * Page /hospitality — overview vertical hôtellerie.
 *
 * Affiche les reports recommandés (3 specs hospitality), les workflow
 * templates verticaux (2 templates) et un raccourci vers la persona
 * "Hospitality Concierge". Sert de hub d'entrée pour le mode vertical.
 */

import Link from "next/link";
import { PageHeader } from "../components/PageHeader";

// DÉMO MVP : IDs fictifs — remplacer par /api/v2/reports/specs?vertical=hospitality
// et /api/v2/missions?template=xxx quand le catalog vertical sera implémenté.
const HOSPITALITY_REPORTS = [
  {
    id: "00000000-0000-4000-8000-700000000001",
    title: "Daily Briefing — Hospitality",
    description:
      "Occupancy, ADR/RevPAR, arrivées + départs du jour, VIP guests et service requests pending.",
  },
  {
    id: "00000000-0000-4000-8000-700000000002",
    title: "RevPAR & ADR — Hospitality",
    description:
      "RevPAR, ADR, occupancy détaillés sur 30 jours et segmentation revenue par source.",
  },
  {
    id: "00000000-0000-4000-8000-700000000003",
    title: "Guest Satisfaction — Hospitality",
    description: "NPS par canal, reviews aggregées, complaints et taux de recovery sur 7 jours.",
  },
];

// DÉMO MVP : IDs fictifs — à remplacer par des missions réelles issues du Builder (C3)
const HOSPITALITY_WORKFLOWS = [
  {
    id: "hospitality-guest-arrival-prep",
    name: "Préparation arrivées VIP",
    description:
      "Cron 10h → arrivées du jour → filtre VIP → welcome notes (Claude) → approval → Slack #frontdesk",
  },
  {
    id: "hospitality-service-request-dispatch",
    name: "Dispatch service request",
    description:
      "Webhook → classify priority (Haiku) → urgent? alert manager : routing standard → update PMS → ticket",
  },
];

export default function HospitalityPage() {
  return (
    <div className="flex-1 flex flex-col min-h-0 bg-bg-elev">
      <PageHeader
        title="Hospitality"
        subtitle="Cockpit IA pour l'hôtellerie haut de gamme — pilotage occupancy, RevPAR, guests et service."
        breadcrumb={[{ label: "Hearst", href: "/" }, { label: "Hospitality" }]}
      />

      <div
        className="flex flex-col gap-12"
        style={{
          padding: "var(--space-8) var(--space-12) var(--space-14)",
        }}
      >
        {/* Banner mode démo : PMS connectors out-of-scope MVP */}
        <div
          className="t-11 text-text-muted"
          style={{
            padding: "var(--space-3) var(--space-4)",
            background: "var(--surface-2)",
            borderLeft: "2px solid var(--warn)",
            borderRadius: "var(--radius-xs)",
          }}
        >
          <strong className="text-text">Mode démo</strong> — les données PMS (Mews, Cloudbeds,
          Opera) sont mockées. Connecte ton PMS via{" "}
          <Link href="/apps" className="text-(--accent-teal)">
            /apps
          </Link>{" "}
          quand l&apos;intégration sera disponible (intégrations PMS planifiées Q3 2026).
        </div>
        <Section label="Reports recommandés" meta="3 specs">
          <div className="flex flex-col gap-3">
            {HOSPITALITY_REPORTS.map((r) => (
              <Link
                key={r.id}
                href={`/reports?spec=${r.id}`}
                className="card-depth flex flex-col p-5 gap-2 no-underline"
              >
                <div className="flex items-center gap-(--space-3)">
                  <span className="t-15 font-medium flex-1" style={{ color: "var(--text-l0)" }}>
                    {r.title}
                  </span>
                  <span
                    className="t-9 font-medium shrink-0"
                    style={{
                      color: "var(--warn)",
                      border: "1px solid var(--warn)",
                      borderRadius: "var(--radius-pill)",
                      padding: "0 var(--space-2)",
                    }}
                  >
                    Démo
                  </span>
                </div>
                <span className="t-13 text-(--text-l2)">{r.description}</span>
              </Link>
            ))}
          </div>
        </Section>

        <Section label="Workflows clé en main" meta="2 templates">
          <div className="flex flex-col gap-3">
            {HOSPITALITY_WORKFLOWS.map((w) => (
              <Link
                key={w.id}
                href={`/missions?template=${w.id}`}
                className="card-depth flex flex-col p-5 gap-2 no-underline"
              >
                <span className="t-15 font-medium" style={{ color: "var(--text-l0)" }}>
                  {w.name}
                </span>
                <span className="t-13 text-(--text-l2)">{w.description}</span>
              </Link>
            ))}
          </div>
        </Section>

        <Section label="Persona dédiée">
          <Link
            href="/personas?builtin=hospitality-concierge"
            className="card-depth flex flex-col p-5 gap-2 no-underline"
          >
            <span className="t-15 font-medium" style={{ color: "var(--text-l0)" }}>
              Hospitality Concierge
            </span>
            <span className="t-13 text-(--text-l2)">
              Voix éditoriale calibrée hôtelier — chaleureuse, discrète, vocabulaire métier (guest,
              room, VIP, ADR, RevPAR), anticipe les besoins.
            </span>
          </Link>
        </Section>

        <Section label="État des connecteurs">
          <div className="card-depth flex flex-col p-5 gap-3">
            <span className="t-9 font-light text-text-faint">PMS · POS · Guest messaging</span>
            <p className="t-13 text-(--text-l2)">
              Aucun connecteur hospitality natif pour MVP. Les KPIs et tables affichés ailleurs sont
              des données démo. Contacte ton commercial pour brancher Mews, Cloudbeds, Opera ou
              Hotelogix.
            </p>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({
  label,
  meta,
  children,
}: {
  label: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-5">
      <header className="flex items-baseline justify-between">
        <span className="t-13 font-medium text-(--text-l1)">{label}</span>
        {meta && <span className="t-11 font-light text-text-faint">{meta}</span>}
      </header>
      {children}
    </section>
  );
}
