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

export function CockpitScene() {
  const [activeSlot, setActiveSlot] = useState("slot-1");
  const [toggle, setToggle] = useState<(typeof TOGGLE_OPTIONS)[number]>("filtre-1");

  return (
    <div className="relative flex h-screen w-screen bg-[#000000] text-[var(--color-ink)] overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 30%, rgba(255,255,255,0.035) 0%, transparent 70%)",
        }}
      />

      {/* Left rail — Plaque de verre avec 3D CSS (perspective + transform) */}
      <aside className="relative z-20 flex h-full w-[68px] flex-col items-center gap-1 py-6 vision-glass">
        {/* Brand slot top - Extrudé */}
        <div className="mb-6 flex size-10 items-center justify-center rounded-[var(--radius-md)] bg-[rgba(255,255,255,0.08)] shadow-[0_4px_10px_rgba(0,0,0,0.5),_inset_0_1px_0_rgba(255,255,255,0.2)]">
          <span className="block size-4 rounded-full bg-[var(--color-ink-strong)]" />
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
                  ? "group relative flex size-11 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-ink)] transition-all duration-300 vision-btn-glass"
                  : "group relative flex size-11 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-fg-mute)] transition-all duration-300 hover:bg-[rgba(255,255,255,0.04)] hover:text-[var(--color-fg-dim)] hover:-translate-y-0.5"
              }
            >
              <IconSlot filled={active} />
              {active && (
                <span className="absolute -left-1 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-[var(--color-ink-strong)]" />
              )}
            </button>
          );
        })}

        <div className="flex-1" />

        {/* User avatar bottom */}
        <div className="mt-4 flex size-9 items-center justify-center rounded-full bg-[rgba(255,255,255,0.1)] text-[length:var(--text-sm)] text-[var(--color-fg-dim)]">
          <Ph>av</Ph>
        </div>
      </aside>

      {/* Right Content Area (Center + Right Rail + Footer) */}
      <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
        {/* Main Content + Right Rail */}
        <div className="flex flex-1 overflow-hidden">
          {/* Centre */}
          <main className="flex flex-1 justify-center overflow-y-auto px-16 py-14">
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
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

              {/* Hero — focus du jour avec effet 3D */}
              <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
                className="relative flex flex-col gap-5 rounded-[var(--radius-lg)] p-8 vision-glass transition-transform duration-500 hover:-translate-y-1"
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
                    className="rounded-[var(--radius-pill)] px-4 py-2 text-[length:var(--text-sm)] font-medium transition-opacity hover:opacity-90 vision-btn-primary"
                  >
                    <Ph>hero-cta-primaire</Ph>
                  </button>
                  <button
                    type="button"
                    className="rounded-[var(--radius-pill)] px-4 py-2 text-[length:var(--text-sm)] text-[var(--color-ink)] transition-colors hover:opacity-90 vision-btn-glass"
                  >
                    <Ph>hero-cta-secondaire</Ph>
                  </button>
                </div>
              </motion.section>

              {/* Activité — liste avec toggle filtre */}
              <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col gap-5"
              >
                <div className="flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-[length:var(--text-md)] font-medium tracking-tight text-[var(--color-ink-strong)]">
                    <span className="inline-block h-4 w-px bg-[rgba(255,255,255,0.2)]" />
                    <Ph>activite-title</Ph>
                  </h2>
                  <div className="flex items-center gap-1 rounded-[var(--radius-pill)] vision-segmented-track p-1">
                    {TOGGLE_OPTIONS.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setToggle(opt)}
                        className={
                          toggle === opt
                            ? "rounded-[var(--radius-pill)] px-4 py-1.5 text-[length:var(--text-sm)] font-medium text-[var(--color-ink-strong)] transition-all vision-btn-glass"
                            : "rounded-[var(--radius-pill)] px-4 py-1.5 text-[length:var(--text-sm)] text-[var(--color-fg-dim)] transition-colors hover:text-[var(--color-ink)]"
                        }
                      >
                        <Ph>{opt}</Ph>
                      </button>
                    ))}
                  </div>
                </div>

                <ul className="flex flex-col">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <li
                      key={i}
                      className="flex items-center gap-4 px-2 py-3.5 border-b border-[rgba(255,255,255,0.06)] last:border-b-0 hover:bg-[rgba(255,255,255,0.02)] transition-colors"
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

          {/* Right rail */}
          <aside className="relative z-20 flex w-[260px] flex-col gap-1 bg-transparent border-l border-[rgba(255,255,255,0.08)] px-5 py-12">
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
                    ? "group flex items-start gap-2 border-l-2 border-[var(--color-ink-strong)] bg-[rgba(255,255,255,0.04)] rounded-r-[var(--radius-sm)] -ml-1 py-2 pl-4 text-left text-[length:var(--text-sm)] text-[var(--color-ink-strong)] transition-colors"
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

        {/* Footer — Plaque de verre avec 3D */}
        <footer className="relative z-30 flex items-center justify-between px-6 py-4 vision-glass">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-[length:var(--text-sm)] font-medium text-[var(--color-fg-dim)]">
              <IconSlot />
              <span>
                <Ph>footer-analysis</Ph>
              </span>
            </div>
          </div>

          {/* Segmented control central */}
          <div className="flex items-center gap-1 rounded-[var(--radius-pill)] p-1 vision-segmented-track">
            {["action-1", "action-2", "action-3"].map((id, index) => (
              <button
                key={id}
                type="button"
                className={`flex items-center gap-2 rounded-[var(--radius-pill)] px-4 py-1.5 text-[length:var(--text-sm)] transition-colors ${
                  index === 0
                    ? "text-white vision-btn-glass"
                    : "text-[rgba(255,255,255,0.5)] hover:text-white"
                }`}
              >
                <IconSlot />
                <Ph>{id}</Ph>
              </button>
            ))}
          </div>

          {/* Segmented control droit */}
          <div className="flex items-center gap-1 rounded-[var(--radius-pill)] p-1 vision-segmented-track">
            {["mode-1", "mode-2"].map((id, index) => (
              <button
                key={id}
                type="button"
                className={`flex items-center gap-2 rounded-[var(--radius-pill)] px-4 py-1.5 text-[length:var(--text-sm)] font-medium transition-all ${
                  index === 0
                    ? "vision-btn-primary"
                    : "text-[rgba(255,255,255,0.5)] hover:text-white"
                }`}
              >
                <IconSlot filled={index === 0} />
                <Ph>{id}</Ph>
              </button>
            ))}
          </div>
        </footer>
      </div>
    </div>
  );
}
