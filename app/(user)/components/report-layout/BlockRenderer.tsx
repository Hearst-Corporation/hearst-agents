/**
 * BlockRenderer — switch sur `block.type` et délègue au composant block
 * approprié. Skeleton inline si `block.data` non chargé.
 *
 * Imports statiques pour les blocs légers (rendu immédiat, pas de skeleton),
 * lazy imports pour les blocs lourds (waterfall, cohort, heatmap, sankey,
 * radar, gantt) — voir `lib/reports/blocks/lazy.tsx`.
 *
 * Le rendu d'un type non câblé (V3 reservé) tombe sur un placeholder
 * `<type>_pending` qui respecte la grille — pas de white block silencieux.
 */

import type { JSX } from "react";
import { Bar } from "@/lib/reports/blocks/Bar";
import { Bullet, type BulletItem } from "@/lib/reports/blocks/Bullet";
import type { CohortRow } from "@/lib/reports/blocks/CohortTriangle";
import { Funnel } from "@/lib/reports/blocks/Funnel";
import type { GanttRange, GanttTask } from "@/lib/reports/blocks/Gantt";
import { inferNumericField } from "@/lib/reports/blocks/infer";
// Blocs légers — import statique, rendu immédiat
import { KpiTile } from "@/lib/reports/blocks/KpiTile";

// Blocs lourds — dynamic imports (lazy) + skeleton + types
import {
  BlockSkeleton,
  LazyCohortTriangle,
  LazyGantt,
  LazyHeatmap,
  LazyRadar,
  LazySankey,
  LazyWaterfall,
} from "@/lib/reports/blocks/lazy";
import type { RadarSeries } from "@/lib/reports/blocks/Radar";
import type { SankeyLink, SankeyNode } from "@/lib/reports/blocks/Sankey";
import { Sparkline } from "@/lib/reports/blocks/Sparkline";
import { Table } from "@/lib/reports/blocks/Table";
import type { WaterfallDatum } from "@/lib/reports/blocks/Waterfall";
import type { RenderedBlock } from "@/lib/reports/engine/render-blocks";

const SPARKLINE_DEFAULT_HEIGHT = 64;
const BAR_DEFAULT_LIMIT = 10;
const TABLE_DEFAULT_LIMIT = 50;
const FUNNEL_DEFAULT_LIMIT = 7;
const WATERFALL_DEFAULT_HEIGHT = 240;
const SANKEY_DEFAULT_HEIGHT = 280;
const RADAR_DEFAULT_HEIGHT = 320;

export function BlockRenderer({ block }: { block: RenderedBlock }): JSX.Element {
  const props = block.props ?? {};

  // Skeleton inline si le bloc n'a pas encore de données (rendu asynchrone futur).
  if (block.data === null || block.data === undefined) {
    return <BlockSkeleton testId={`block-skeleton-${block.id}`} />;
  }

  switch (block.type) {
    case "kpi":
      return (
        <KpiTile
          data={
            block.data as {
              value: unknown;
              delta?: unknown;
              sparkline?: ReadonlyArray<number> | null;
            }
          }
          label={block.label ?? block.id}
          format={(props.format as "number" | "currency" | "percent") ?? "number"}
          currency={(props.currency as string) ?? "EUR"}
          suffix={props.suffix as string | undefined}
          compact={Boolean(props.compact)}
          captionHtml={typeof props.captionHtml === "string" ? props.captionHtml : undefined}
        />
      );

    case "sparkline": {
      const rows = block.data as ReadonlyArray<Record<string, unknown>>;
      const field = (props.field as string) ?? inferNumericField(rows[0]);
      const values = field
        ? rows.map((r) => Number(r[field])).filter((v) => Number.isFinite(v))
        : [];
      return (
        <Sparkline
          values={values}
          height={(props.height as number) ?? SPARKLINE_DEFAULT_HEIGHT}
          tone={(props.tone as "accent-teal" | "warn" | "danger" | "muted") ?? "accent-teal"}
          label={block.label}
        />
      );
    }

    case "bar":
      return (
        <Bar
          data={block.data as ReadonlyArray<Record<string, unknown>>}
          labelField={props.labelField as string | undefined}
          valueField={props.valueField as string | undefined}
          limit={(props.limit as number) ?? BAR_DEFAULT_LIMIT}
          format={(props.format as "number" | "currency") ?? "number"}
          currency={(props.currency as string) ?? "EUR"}
          tone={(props.tone as "accent-teal" | "warn" | "danger" | "muted") ?? "accent-teal"}
          direction={(props.direction as "asc" | "desc" | "none") ?? "desc"}
        />
      );

    case "table":
      return (
        <Table
          data={block.data as ReadonlyArray<Record<string, unknown>>}
          columns={props.columns as ReadonlyArray<string> | undefined}
          labels={props.labels as Record<string, string> | undefined}
          formats={
            props.formats as Record<string, "number" | "currency" | "date" | "text"> | undefined
          }
          currency={(props.currency as string) ?? "EUR"}
          limit={(props.limit as number) ?? TABLE_DEFAULT_LIMIT}
        />
      );

    case "funnel":
      return (
        <Funnel
          data={block.data as ReadonlyArray<Record<string, unknown>>}
          labelField={props.labelField as string | undefined}
          valueField={props.valueField as string | undefined}
          limit={(props.limit as number) ?? FUNNEL_DEFAULT_LIMIT}
          tone={(props.tone as "accent-teal" | "warn") ?? "accent-teal"}
        />
      );

    case "waterfall":
      return (
        <LazyWaterfall
          data={(props.data as ReadonlyArray<WaterfallDatum>) ?? []}
          height={(props.height as number) ?? WATERFALL_DEFAULT_HEIGHT}
          format={(props.format as "number" | "currency") ?? "currency"}
          currency={(props.currency as string) ?? "EUR"}
        />
      );

    case "cohort_triangle":
      return (
        <LazyCohortTriangle
          cohorts={(props.cohorts as ReadonlyArray<CohortRow>) ?? []}
          periodPrefix={(props.periodPrefix as string) ?? "M"}
          asPercent={props.asPercent !== false}
        />
      );

    case "heatmap":
      return (
        <LazyHeatmap
          xLabels={(props.xLabels as ReadonlyArray<string>) ?? []}
          yLabels={(props.yLabels as ReadonlyArray<string>) ?? []}
          values={(props.values as ReadonlyArray<ReadonlyArray<number>>) ?? []}
          cellHeight={props.cellHeight as number | undefined}
          showValues={Boolean(props.showValues)}
        />
      );

    case "sankey":
      return (
        <LazySankey
          nodes={(props.nodes as ReadonlyArray<SankeyNode>) ?? []}
          links={(props.links as ReadonlyArray<SankeyLink>) ?? []}
          height={(props.height as number) ?? SANKEY_DEFAULT_HEIGHT}
        />
      );

    case "bullet":
      return (
        <Bullet
          items={(props.items as ReadonlyArray<BulletItem>) ?? []}
          format={(props.format as "number" | "currency") ?? "number"}
          currency={(props.currency as string) ?? "EUR"}
        />
      );

    case "radar":
      return (
        <LazyRadar
          axes={(props.axes as ReadonlyArray<string>) ?? []}
          series={(props.series as ReadonlyArray<RadarSeries>) ?? []}
          height={(props.height as number) ?? RADAR_DEFAULT_HEIGHT}
          rings={props.rings as number | undefined}
        />
      );

    case "gantt":
      return (
        <LazyGantt
          range={(props.range as GanttRange) ?? { start: "", end: "" }}
          tasks={(props.tasks as ReadonlyArray<GanttTask>) ?? []}
          height={props.height as number | undefined}
        />
      );

    default:
      // Primitives non câblées — placeholder respectant la grille du layout.
      return (
        <div
          className="flex items-center justify-center"
          style={{
            padding: "var(--space-6)",
            background: "var(--card-flat-bg)",
            border: "1px dashed var(--card-flat-border)",
            minHeight: "var(--space-12)",
          }}
          aria-label={`Bloc ${block.type} non disponible`}
        >
          <span className="t-11 font-light text-text-faint">
            Bloc « {block.type} » non disponible
          </span>
        </div>
      );
  }
}
