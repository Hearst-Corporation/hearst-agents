import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { useState } from "react";

/** Placeholder visible : tout ce qui est faux est wrappé. */
function Ph({ children }: { children: ReactNode }) {
  return (
    <span className="italic opacity-50" style={{ color: "currentColor" }}>
      [{children}]
    </span>
  );
}

/** Carré abstrait pour figurer un emplacement icône — neutre, sans sémantique Hearst. */
function IconSlot({ filled = false }: { filled?: boolean }) {
  return (
    <span
      className={
        filled
          ? "block size-4 rounded-[3px] bg-current opacity-80"
          : "block size-4 rounded-[3px] border border-current opacity-40"
      }
    />
  );
}

const LEFT_RAIL_SLOTS = Array.from({ length: 10 }, (_, i) => `slot-${i + 1}`);
const TOGGLE_OPTIONS = ["filtre-1", "filtre-2"] as const;

const FOOTER_CHIPS_LEFT = ["verbe-1", "verbe-2", "verbe-3"];
const FOOTER_CHIPS_RIGHT = ["primary-1", "primary-2"];

export function CockpitScene() {
  const [activeSlot, setActiveSlot] = useState("slot-1");
  const [toggle, setToggle] = useState<(typeof TOGGLE_OPTIONS)[number]>("filtre-1");

  return (
    <div className="relative flex h-screen w-screen flex-col bg-[var(--color-bg)] text-[var(--color-ink)]">
      {/* 1. Ambient Glow (Spatial UI - Voile coloré diffus en N&B) */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-50"
        style={{
          background:
            "radial-gradient(ellipse at 50% 30%, rgba(255, 255, 255, 0.04) 0%, transparent 60%)",
        }}
      />

      <div className="relative z-10 flex flex-1 overflow-hidden">
        {/* Left rail — 10 slots abstraits */}
        <aside className="flex w-[56px] flex-col items-center gap-1 bg-transparent py-6 border-r border-[rgba(255,255,255,0.03)]">
          {/* Brand slot top */}
          <div className="mb-6 flex size-9 items-center justify-center rounded-[var(--radius-md)] bg-[rgba(255,255,255,0.1)] shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]">
            <span className="block size-3.5 rounded-full bg-[var(--color-ink-strong)]" />
          </div>

          {LEFT_RAIL_SLOTS.map((slot) => {
            const active = activeSlot === slot;
            return (
              <button
                key={slot}
                type="button"
                onClick={() => setActiveSlot(slot)}
                aria-label={slot}
                title={slot}
                className={
                  active
                    ? "group relative flex size-10 items-center justify-center rounded-[var(--radius-md)] bg-[rgba(255,255,255,0.06)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] text-[var(--color-ink)] transition-colors"
                    : "group relative flex size-10 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-fg-mute)] transition-colors hover:bg-[rgba(255,255,255,0.03)] hover:text-[var(--color-fg-dim)]"
                }
              >
                <IconSlot filled={active} />
                {active && (
                  <span className="absolute -left-3 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full bg-[var(--color-ink-strong)]" />
                )}
              </button>
            );
          })}

          <div className="flex-1" />

          {/* Bottom utility slots */}
          {["util-1", "util-2", "util-3"].map((s) => (
            <button
              key={s}
              type="button"
              aria-label={s}
              title={s}
              className="flex size-10 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-fg-mute)] transition-colors hover:bg-[rgba(255,255,255,0.03)] hover:text-[var(--color-fg-dim)]"
            >
              <IconSlot />
            </button>
          ))}
        </aside>

        {/* Centre — cockpit home, pas page-détail */}
        <main className="flex flex-1 justify-center overflow-y-auto px-16 py-14">
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
            className="flex w-full max-w-[720px] flex-col gap-14"
          >
            {/* Greeting */}
            <header className="flex flex-col gap-3">
              <p className="text-[length:var(--text-cap)] uppercase tracking-[0.08em] text-[var(--color-fg-mute)]">
                <Ph>date-longue</Ph>
              </p>
              <h1 className="text-[32px] font-medium leading-[1.05] tracking-[-0.025em] text-[var(--color-ink-strong)]">
                <Ph>greeting</Ph>, <Ph>prenom-user</Ph>.
              </h1>
              <p className="max-w-[640px] text-[length:var(--text-base)] leading-[1.6] text-[var(--color-fg-dim)]">
                <Ph>summary-jour-1</Ph> <Ph>summary-jour-2</Ph> <Ph>summary-jour-3</Ph>
              </p>
            </header>

            {/* Hero — focus du jour */}
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.08, ease: [0.34, 1.56, 0.64, 1] }}
              /* 2. Dark Glass & 3. Rim Light (Spatial UI) */
              className="relative flex flex-col gap-5 rounded-[var(--radius-lg)] p-8 backdrop-blur-md bg-gradient-to-r from-[rgba(255,255,255,0.04)] to-transparent border-t border-l border-[rgba(255,255,255,0.06)] shadow-[20px_20px_40px_rgba(0,0,0,0.5)]"
            >
              <div className="relative flex items-baseline justify-between">
                <span className="text-[length:var(--text-cap)] uppercase tracking-[0.08em] text-[var(--color-fg-mute)]">
                  <Ph>hero-label</Ph>
                </span>
                <span className="text-[length:var(--text-sm)] text-[var(--color-fg-dim)]">
                  <Ph>hero-meta</Ph>
                </span>
              </div>
              <h2 className="relative flex items-center gap-2 max-w-[600px] text-[28px] font-medium leading-[1.15] tracking-[-0.015em] text-[var(--color-ink-strong)]">
                <span className="inline-block h-5 w-px bg-[rgba(255,255,255,0.2)] shrink-0" />
                <span>
                  <Ph>hero-title-ligne-1</Ph> <Ph>hero-title-ligne-2</Ph>
                </span>
              </h2>
              <p className="relative max-w-[580px] text-[length:var(--text-base)] leading-[1.6] text-[var(--color-fg-dim)]">
                <Ph>hero-body-1</Ph> <Ph>hero-body-2</Ph>
              </p>
              <div className="relative flex items-center gap-3 pt-2">
                <button
                  type="button"
                  className="rounded-[var(--radius-pill)] bg-[var(--color-ink-strong)] px-4 py-2 text-[length:var(--text-sm)] font-medium text-[var(--color-bg)] transition-opacity hover:opacity-90 shadow-lg"
                >
                  <Ph>hero-cta-primaire</Ph>
                </button>
                <button
                  type="button"
                  className="rounded-[var(--radius-pill)] px-4 py-2 text-[length:var(--text-sm)] text-[var(--color-ink)] transition-colors hover:bg-[rgba(255,255,255,0.06)] border border-transparent hover:border-[rgba(255,255,255,0.1)]"
                >
                  <Ph>hero-cta-secondaire</Ph>
                </button>
              </div>
            </motion.section>

            {/* Activité — liste avec toggle filtre */}
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.16, ease: [0.34, 1.56, 0.64, 1] }}
              className="flex flex-col gap-5"
            >
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-[length:var(--text-md)] font-medium tracking-tight text-[var(--color-ink-strong)]">
                  <span className="inline-block h-4 w-px bg-[rgba(255,255,255,0.2)]" />
                  <Ph>activite-title</Ph>
                </h2>
                <div className="flex items-center gap-1 rounded-[var(--radius-pill)] bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)] p-1">
                  {TOGGLE_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setToggle(opt)}
                      className={
                        toggle === opt
                          ? "rounded-[var(--radius-pill)] bg-[rgba(255,255,255,0.08)] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] px-4 py-1.5 text-[length:var(--text-sm)] font-medium text-[var(--color-ink-strong)] transition-all"
                          : "rounded-[var(--radius-pill)] px-4 py-1.5 text-[length:var(--text-sm)] text-[var(--color-fg-dim)] transition-colors hover:text-[var(--color-ink)]"
                      }
                    >
                      <Ph>{opt}</Ph>
                    </button>
                  ))}
                </div>
              </div>

              <ul className="flex flex-col gap-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <li
                    key={i}
                    /* 2. Dark Glass & 3. Rim Light sur chaque row */
                    className="flex items-center gap-4 rounded-[var(--radius-pill)] bg-gradient-to-r from-[rgba(255,255,255,0.04)] to-transparent px-5 py-3 border-t border-[rgba(255,255,255,0.06)] shadow-[0_4px_12px_rgba(0,0,0,0.2)] backdrop-blur-sm"
                  >
                    <IconSlot />
                    <div className="flex flex-1 flex-col gap-0.5">
                      <span className="text-[length:var(--text-base)] text-[var(--color-ink)]">
                        <Ph>activite-titre-{i}</Ph>
                      </span>
                      <span className="text-[length:var(--text-sm)] text-[var(--color-fg-mute)]">
                        <Ph>activite-meta-{i}</Ph>
                      </span>
                    </div>
                    <span className="text-[length:var(--text-sm)] text-[var(--color-fg-dim)]">
                      <Ph>ago-{i}</Ph>
                    </span>
                  </li>
                ))}
              </ul>
            </motion.section>
          </motion.section>
        </main>

        {/* Right rail — feed signaux */}
        <aside className="flex w-[200px] flex-col gap-1 border-l border-[rgba(255,255,255,0.03)] px-5 py-12">
          <h3 className="mb-2 text-[length:var(--text-cap)] uppercase tracking-[0.08em] text-[var(--color-fg-mute)]">
            <Ph>rail-droit-titre</Ph>
          </h3>
          {[
            { id: "feed-1", hot: false },
            { id: "feed-2", hot: false },
            { id: "feed-3", hot: true },
            { id: "feed-4", hot: false },
            { id: "feed-5", hot: false },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              className={
                item.hot
                  ? "group flex items-start gap-2 border-l-2 border-[var(--color-ink-strong)] py-2 pl-3 text-left text-[length:var(--text-sm)] text-[var(--color-ink-strong)] transition-colors"
                  : "group flex items-start gap-2 border-l-2 border-transparent py-2 pl-3 text-left text-[length:var(--text-sm)] text-[var(--color-fg-dim)] transition-colors hover:text-[var(--color-ink)]"
              }
            >
              <span className="leading-snug">
                <Ph>{item.id}-ligne-titre</Ph>
                <br />
                <span className={item.hot ? "opacity-90" : "opacity-70"}>
                  <Ph>{item.id}-snippet</Ph>
                </span>
              </span>
            </button>
          ))}
        </aside>
      </div>

      {/* Footer — command bar */}
      <footer className="relative z-20 flex items-center gap-4 bg-[rgba(20,20,20,0.6)] backdrop-blur-md px-6 py-3 border-t border-[rgba(255,255,255,0.03)]">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-full bg-[rgba(255,255,255,0.05)] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] text-[length:var(--text-sm)] text-[var(--color-fg-dim)]">
            <Ph>av</Ph>
          </div>
          <div className="flex items-center gap-2 text-[length:var(--text-sm)] text-[var(--color-fg-dim)]">
            <span className="text-[length:var(--text-sm)] text-[var(--color-fg-mute)]">⌘</span>
            <span>
              <Ph>contexte-footer</Ph>
            </span>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center gap-2">
          {FOOTER_CHIPS_LEFT.map((id) => (
            <button
              key={id}
              type="button"
              className="flex items-center gap-2 rounded-[var(--radius-pill)] bg-transparent px-4 py-2 text-[length:var(--text-sm)] text-[var(--color-fg-dim)] transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-[var(--color-ink)]"
            >
              <IconSlot />
              <Ph>{id}</Ph>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {FOOTER_CHIPS_RIGHT.map((id) => (
            <button
              key={id}
              type="button"
              className="group flex items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-ink)] px-4 py-2 text-[length:var(--text-sm)] font-medium text-[var(--color-bg)] transition-all hover:bg-white hover:opacity-95 shadow-md"
            >
              <IconSlot filled />
              <Ph>{id}</Ph>
            </button>
          ))}
        </div>
      </footer>
    </div>
  );
}
