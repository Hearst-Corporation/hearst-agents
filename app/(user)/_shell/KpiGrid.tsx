"use client";

/**
 * KpiGrid — grille de métriques telemetry (style cockpit ref).
 *
 * 4 KPIs en grille 2×2 avec barre de progression et valeur.
 */

import { motion } from "framer-motion";

interface KpiItem {
  id: string;
  label: string;
  value: string;
  footnote: string;
  tone: "active" | "rest" | "warn";
  progress: number;
}

interface KpiGridProps {
  items: KpiItem[];
}

const TONE_COLOR: Record<KpiItem["tone"], string> = {
  active: "var(--accent-teal)",
  rest: "var(--text-ghost)",
  warn: "var(--warn)",
};

export function KpiGrid({ items }: KpiGridProps) {
  return (
    <div
      className="ct-kpi-grid"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: "var(--space-3)",
        marginBottom: "var(--space-4)",
      }}
    >
      {items.map((item, i) => (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 * i, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          style={{
            background: "var(--surface-1)",
            border: "1px solid var(--border-shell)",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-4)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-2)",
          }}
        >
          <span
            style={{
              fontSize: "var(--font-size-10, 10px)",
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--text-faint)",
            }}
          >
            {item.label}
          </span>
          <span
            style={{
              fontSize: "var(--font-size-28, 28px)",
              fontWeight: 300,
              letterSpacing: "-0.02em",
              color: "var(--text)",
              lineHeight: "var(--line-height-tight, 1.1)",
              fontFamily: "var(--font-satoshi)",
            }}
          >
            {item.value}
          </span>
          <div
            style={{
              height: "2px",
              width: "100%",
              background: "var(--border-shell)",
              borderRadius: "1px",
              overflow: "hidden",
            }}
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${item.progress}%` }}
              transition={{ delay: 0.3 + 0.1 * i, duration: 0.8, ease: "easeOut" }}
              style={{
                height: "100%",
                background: TONE_COLOR[item.tone],
                borderRadius: "1px",
              }}
            />
          </div>
          <span
            style={{
              fontSize: "var(--font-size-11, 11px)",
              color:
                item.tone === "warn"
                  ? "var(--warn)"
                  : item.tone === "active"
                    ? "var(--accent-teal)"
                    : "var(--text-ghost)",
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.02em",
            }}
          >
            {item.footnote}
          </span>
        </motion.div>
      ))}
    </div>
  );
}
