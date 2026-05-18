"use client";

import { motion, type Variants } from "framer-motion";
import { useState } from "react";
import type { RailItem } from "../_stages/types";
import { ChatKimiPanel } from "./ChatKimiPanel";

const RAIL_CONTAINER_VARIANTS: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.2 } },
};

const RAIL_ITEM_VARIANTS: Variants = {
  hidden: { opacity: 0, x: 10 },
  show: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const },
  },
};

type Tab = "context" | "kimi";

type RightRailProps = {
  title: string;
  items: readonly RailItem[];
};

/**
 * RightRail — contexte du stage actif + chat Kimi K2.6 intégré.
 *
 * Deux onglets :
 *   - « Contexte » : rail items du stage actif (comportement P4 inchangé)
 *   - « Kimi »    : ChatKimiPanel (streaming /api/cockpit-chat, tokens visionOS)
 *
 * Aucun token .ct-* utilisé — entièrement visionOS.
 */
export function RightRail({ title, items }: RightRailProps) {
  const [activeTab, setActiveTab] = useState<Tab>("context");

  return (
    <aside
      aria-label="Rail droit"
      className="vision-rail-right preserve-3d relative z-20 hidden xl:flex xl:w-[260px] shrink-0 flex-col border-l border-line-strong bg-surface 2xl:w-[320px]"
    >
      {/* Onglets */}
      <div
        className="flex shrink-0 border-b border-line-strong"
        role="tablist"
        aria-label="Sections rail droit"
      >
        <TabButton
          active={activeTab === "context"}
          onClick={() => setActiveTab("context")}
          label="Contexte"
          id="tab-context"
          controls="panel-context"
        />
        <TabButton
          active={activeTab === "kimi"}
          onClick={() => setActiveTab("kimi")}
          label="Kimi"
          id="tab-kimi"
          controls="panel-kimi"
        />
      </div>

      {/* Panneau Contexte */}
      <div
        id="panel-context"
        role="tabpanel"
        aria-labelledby="tab-context"
        hidden={activeTab !== "context"}
        className="flex flex-col flex-1 overflow-y-auto px-5 py-8 gap-2 2xl:px-8 2xl:py-10"
      >
        <h3 className="mb-3 pl-3 text-xs font-medium text-text-faint 2xl:mb-4 2xl:pl-4 2xl:text-sm">
          {title}
        </h3>
        <motion.div
          key={title}
          variants={RAIL_CONTAINER_VARIANTS}
          initial="hidden"
          animate="show"
          className="flex flex-col gap-2"
        >
          {items.length === 0 ? (
            <p className="px-3 text-xs text-text-ghost 2xl:px-4 2xl:text-sm">
              Aucun signal pour l&apos;instant.
            </p>
          ) : (
            items.map((item, idx) => (
              <motion.div
                variants={RAIL_ITEM_VARIANTS}
                key={idx}
                className={`flex flex-col gap-1 rounded-lg border p-3 text-sm transition-colors 2xl:p-4 2xl:text-base ${
                  item.hot
                    ? "border-line-strong bg-bg-elev text-white"
                    : "border-transparent text-text-muted"
                }`}
              >
                <span className="leading-snug">{item.t}</span>
                <span
                  className={`t-10 block font-mono tracking-wide ${
                    item.hot ? "text-text-muted" : "text-text-ghost"
                  }`}
                >
                  {item.s}
                </span>
              </motion.div>
            ))
          )}
        </motion.div>
      </div>

      {/* Panneau Kimi */}
      <div
        id="panel-kimi"
        role="tabpanel"
        aria-labelledby="tab-kimi"
        hidden={activeTab !== "kimi"}
        className="flex flex-col flex-1 overflow-hidden"
      >
        {activeTab === "kimi" && <ChatKimiPanel />}
      </div>
    </aside>
  );
}

/* -------------------------------------------------------------------------- */
/*                              TabButton                                      */
/* -------------------------------------------------------------------------- */

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
  id: string;
  controls: string;
}

function TabButton({ active, onClick, label, id, controls }: TabButtonProps) {
  return (
    <button
      type="button"
      role="tab"
      id={id}
      aria-selected={active}
      aria-controls={controls}
      onClick={onClick}
      className={`flex-1 px-3 py-2.5 text-xs font-medium tracking-wide transition-colors duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20 ${
        active
          ? "text-white border-b-2 border-accent-teal"
          : "text-text-ghost hover:text-text-faint border-b-2 border-transparent"
      }`}
    >
      {label}
    </button>
  );
}
