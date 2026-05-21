"use client";

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
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
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
            padding: "var(--space-5)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-2)",
          }}
        >
          <span
            className="t-11 font-semibold"
            style={{
              letterSpacing: "var(--tracking-caption)",
              textTransform: "uppercase",
              color: "var(--text-faint)",
              fontFamily: "var(--font-satoshi)",
            }}
          >
            {item.label}
          </span>
          <span
            className="t-28 font-light"
            style={{
              letterSpacing: "var(--tracking-editorial)",
              color: "var(--text)",
              lineHeight: 1.1,
              fontFamily: "var(--font-satoshi)",
            }}
          >
            {item.value}
          </span>
          <div
            style={{
              height: "2px",
              background: "var(--border-shell)",
              borderRadius: "1px",
              overflow: "hidden",
            }}
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${item.progress}%` }}
              transition={{ delay: 0.3 + 0.1 * i, duration: 0.8, ease: "easeOut" }}
              style={{ height: "100%", background: TONE_COLOR[item.tone], borderRadius: "1px" }}
            />
          </div>
          <span
            style={{
              fontSize: "12px",
              color:
                item.tone === "warn"
                  ? "var(--warn)"
                  : item.tone === "active"
                    ? "var(--accent-teal)"
                    : "var(--text-ghost)",
              fontFamily: "var(--font-satoshi)",
              letterSpacing: "0.01em",
            }}
          >
            {item.footnote}
          </span>
        </motion.div>
      ))}
    </div>
  );
}
