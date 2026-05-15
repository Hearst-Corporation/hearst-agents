"use client";

/**
 * <ScreenShell> — coquille canonique pour TOUS les écrans de l'app.
 *
 * Pattern unique = une seule façon d'organiser un écran :
 *
 *   ┌──────────────────────────────────────┐
 *   │ <PageHeader>  titre + actions        │  ← px-12 py-6
 *   ├──────────────────────────────────────┤
 *   │ [optionnel] stats / KPIs en bande    │  ← px-12 py-4, border-b
 *   ├──────────────────────────────────────┤
 *   │ <main scroll>  contenu               │  ← px-12 py-6, overflow-y-auto
 *   │   (loading | empty | enfant)         │
 *   └──────────────────────────────────────┘
 *
 * Internalise les 3 états (loading, empty, content) et les patterns de
 * padding / gap / border. Source unique pour : missions, reports, runs,
 * apps, assets, marketplace, personas, notifications, planner…
 *
 * À combiner avec <PageHeader> (titre éditorial), <KpiCard> ou des chips
 * compactes pour les stats, <EmptyState>, <RowSkeleton>, <CardSkeleton>.
 *
 * Tokens uniquement (CLAUDE.md §1).
 */

import type { ReactNode } from "react";
import type { Crumb } from "../Breadcrumb";
import { PageHeader } from "../PageHeader";
import { EmptyState } from "./EmptyState";
import { CardSkeleton, RowSkeleton } from "./Skeleton";

interface ScreenShellEmpty {
  title: string;
  description?: string;
  icon?: ReactNode;
  cta?: { label: string; href?: string; onClick?: () => void };
}

interface ScreenShellProps {
  // Header
  title: string;
  subtitle?: string;
  breadcrumb?: Crumb[];
  back?: { label: string; href: string };
  actions?: ReactNode;

  // Bande de stats / KPIs (optionnelle). Si omise ou null, pas de bande.
  stats?: ReactNode;

  // États gérés par le shell
  loading?: boolean;
  loadingVariant?: "rows" | "cards";
  empty?: ScreenShellEmpty | false;

  // Contenu principal — rendu seulement si !loading et !empty
  children?: ReactNode;

  // Background du shell.
  // - `surface` (défaut) = `var(--surface)` — Stage canvas, identique au cockpit
  //   (post-Spotlight 2026-05-10 : noir absolu). Toutes les pages héritent
  //   du même fond pour zéro flicker entre routes.
  // - `elevated` = `var(--bg-elev)` — opt-in pour écrans qui veulent
  //   explicitement un wash gris (rare).
  // - `base` = `var(--bg)` — écrans plus sombres (planner, runs)
  // - `transparent` = laisse passer le shell parent
  background?: "surface" | "elevated" | "base" | "transparent";

  testId?: string;
}

export function ScreenShell({
  title,
  subtitle,
  breadcrumb,
  back,
  actions,
  stats,
  loading = false,
  loadingVariant = "rows",
  empty,
  children,
  background = "surface",
  testId,
}: ScreenShellProps) {
  const bg =
    background === "surface"
      ? "var(--surface)"
      : background === "elevated"
        ? "var(--bg-elev)"
        : background === "base"
          ? "var(--bg)"
          : "transparent";

  return (
    <div
      data-testid={testId}
      className="flex-1 flex flex-col min-h-0 overflow-hidden"
      style={{ background: bg }}
    >
      <PageHeader
        title={title}
        subtitle={subtitle}
        breadcrumb={breadcrumb}
        back={back}
        actions={actions}
      />

      {stats && (
        <div
          className="flex items-center shrink-0 border-b"
          style={{
            gap: "var(--space-4)",
            padding: "var(--space-4) var(--space-12)",
            borderColor: "var(--border-shell)",
          }}
        >
          {stats}
        </div>
      )}

      <div
        className="flex-1 overflow-y-auto no-scrollbar scroll-fade-bottom"
        style={{ padding: "var(--space-6) var(--space-12)" }}
      >
        {loading ? (
          loadingVariant === "cards" ? (
            <CardSkeleton count={6} columns={3} />
          ) : (
            <RowSkeleton count={5} height="var(--space-16)" />
          )
        ) : empty ? (
          <EmptyState
            title={empty.title}
            description={empty.description}
            icon={empty.icon}
            cta={empty.cta}
          />
        ) : (
          children
        )}
      </div>
    </div>
  );
}
