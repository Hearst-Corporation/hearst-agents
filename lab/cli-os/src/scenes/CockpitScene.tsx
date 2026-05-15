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

const RAIL_CONTAINER_VARIANTS = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.2 } },
};
const RAIL_ITEM_VARIANTS = {
  hidden: { opacity: 0, x: 10 },
  show: { opacity: 1, x: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

const RIGHT_RAIL_ITEMS = [
  { id: "feed-1", hot: false },
  { id: "feed-2", hot: false },
  { id: "feed-3", hot: true },
  { id: "feed-4", hot: false },
  { id: "feed-5", hot: false },
] as const;

const LIST_VARIANTS = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const LIST_ITEM_VARIANTS = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

// --- Sous-composants ---

function AmbientLayers() {
  return (
    <>
      {/* Ambient layer 1 — halo blanc doux centré sur la hero (auréole de focus) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 38% 32% at 50% 42%, rgba(255, 255, 255, 0.10), transparent 70%)",
          filter: "blur(50px)",
        }}
      />

      {/* Ambient layer 2 — pattern dots teal (signature Hearst), blurré = profondeur identitaire */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(94, 229, 195, 0.32) 0.8px, transparent 1.4px)",
          backgroundSize: "26px 26px",
          backgroundPosition: "0 0",
          maskImage:
            "radial-gradient(ellipse 90% 80% at 50% 45%, black 0%, rgba(0,0,0,0.5) 50%, transparent 90%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 90% 80% at 50% 45%, black 0%, rgba(0,0,0,0.5) 50%, transparent 90%)",
          opacity: 0.65,
        }}
      />
    </>
  );
}

function LeftRail({
  activeSlot,
  setActiveSlot,
}: {
  activeSlot: string;
  setActiveSlot: (s: string) => void;
}) {
  return (
    <aside aria-label="Navigation principale" className="relative z-20 h-full w-[88px] shrink-0">
      <div className="flex h-full w-full flex-col items-center gap-3 py-8 vision-glass preserve-3d vision-rail-left border-y-0 border-l-0">
        {/* Brand slot top */}
        <div className="mb-6 flex size-12 items-center justify-center rounded-xl bg-[rgba(255,255,255,0.1)] shadow-[0_8px_16px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.3)]">
          <span className="block size-5 rounded-full bg-white" />
        </div>

        {LEFT_RAIL_SLOTS.map((slot) => {
          const active = activeSlot === slot;
          return (
            <motion.button
              whileTap={{ scale: 0.9 }}
              key={slot}
              type="button"
              onClick={() => setActiveSlot(slot)}
              aria-label={slot}
              title={slot}
              className={`group relative flex size-14 items-center justify-center rounded-xl transition-all duration-300 ${active ? "z-10 text-white vision-btn-glass" : "text-[rgba(255,255,255,0.5)] hover:bg-[rgba(255,255,255,0.06)] hover:text-white"}`}
            >
              <IconSlot filled={active} />
            </motion.button>
          );
        })}

        <div className="flex-1" />

        {/* User avatar bottom */}
        <div className="mt-4 flex size-12 items-center justify-center rounded-full bg-[rgba(255,255,255,0.15)] text-base text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
          <Ph>av</Ph>
        </div>
      </div>
    </aside>
  );
}

function RightRail() {
  return (
    <aside
      aria-label="Contexte"
      className="relative z-20 flex w-[320px] shrink-0 flex-col gap-2 border-l border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] px-8 py-14 preserve-3d vision-rail-right"
    >
      <h3 className="mb-4 pl-4 text-sm font-medium text-[rgba(255,255,255,0.5)]">
        <Ph>rail-droit-titre</Ph>
      </h3>
      <motion.div
        variants={RAIL_CONTAINER_VARIANTS}
        initial="hidden"
        animate="show"
        className="flex flex-col gap-2"
      >
        {RIGHT_RAIL_ITEMS.map((item) => (
          <motion.button
            variants={RAIL_ITEM_VARIANTS}
            whileTap={{ scale: 0.98 }}
            key={item.id}
            type="button"
            className={`group flex items-start gap-4 rounded-lg p-4 text-left text-base transition-colors ${item.hot ? "bg-[rgba(255,255,255,0.08)] text-white" : "text-[rgba(255,255,255,0.6)] hover:bg-[rgba(255,255,255,0.04)] hover:text-white"}`}
          >
            <span className="leading-snug">
              <Ph>{item.id}-ligne-titre</Ph>
              <br />
              <span
                className={`block mt-1 text-sm ${item.hot ? "text-[rgba(255,255,255,0.7)]" : "text-[rgba(255,255,255,0.4)]"}`}
              >
                <Ph>{item.id}-snippet</Ph>
              </span>
            </span>
          </motion.button>
        ))}
      </motion.div>
    </aside>
  );
}

const FOOTER_ACTIONS = ["action-1", "action-2", "action-3"] as const;
const FOOTER_MODES = ["mode-1", "mode-2"] as const;

function FloatingFooter() {
  const [activeAction, setActiveAction] = useState<string>("action-1");
  const [activeMode, setActiveMode] = useState<string>("mode-1");

  return (
    <footer
      aria-label="Actions cockpit"
      className="absolute bottom-8 left-1/2 z-30 flex w-max items-center gap-12 rounded-pill px-8 py-5 vision-glass preserve-3d vision-footer-float"
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-3 text-base font-medium text-[rgba(255,255,255,0.7)]">
          <IconSlot />
          <span>
            <Ph>footer-analysis</Ph>
          </span>
        </div>
      </div>

      {/* Segmented control central */}
      <div className="flex items-center gap-1 rounded-pill p-1.5 vision-segmented-track">
        {FOOTER_ACTIONS.map((id) => (
          <motion.button
            whileTap={{ scale: 0.95 }}
            key={id}
            type="button"
            onClick={() => setActiveAction(id)}
            aria-pressed={activeAction === id}
            className={`flex items-center gap-2 rounded-pill px-6 py-2 text-sm transition-colors ${
              activeAction === id
                ? "text-white vision-btn-glass"
                : "text-[rgba(255,255,255,0.5)] hover:text-white"
            }`}
          >
            <IconSlot />
            <Ph>{id}</Ph>
          </motion.button>
        ))}
      </div>

      {/* Segmented control droit */}
      <div className="flex items-center gap-1 rounded-pill p-1.5 vision-segmented-track">
        {FOOTER_MODES.map((id) => (
          <motion.button
            whileTap={{ scale: 0.95 }}
            key={id}
            type="button"
            onClick={() => setActiveMode(id)}
            aria-pressed={activeMode === id}
            className={`flex items-center gap-2 rounded-pill px-6 py-2 text-sm font-medium transition-all ${
              activeMode === id
                ? "vision-btn-primary"
                : "text-[rgba(255,255,255,0.5)] hover:text-white"
            }`}
          >
            <IconSlot filled={activeMode === id} />
            <Ph>{id}</Ph>
          </motion.button>
        ))}
      </div>
    </footer>
  );
}

// --- Composant Principal ---

export function CockpitScene() {
  const [activeSlot, setActiveSlot] = useState("slot-1");
  const [toggle, setToggle] = useState<(typeof TOGGLE_OPTIONS)[number]>("filtre-1");

  return (
    <div className="relative flex h-screen w-screen bg-[#050505] text-white overflow-hidden perspective-scene">
      <AmbientLayers />
      <LeftRail activeSlot={activeSlot} setActiveSlot={setActiveSlot} />

      {/* Right Content Area (Center + Right Rail) */}
      <div className="relative z-10 flex flex-1 overflow-hidden preserve-3d">
        {/* Main Content Area (Scrollable + Floating Footer) */}
        <div className="relative flex flex-1 flex-col overflow-hidden preserve-3d">
          {/* Centre */}
          <main className="flex flex-1 justify-center overflow-y-auto px-16 pt-20 pb-64 vision-content-depth preserve-3d">
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="flex w-full max-w-[760px] flex-col gap-16 preserve-3d"
            >
              {/* Greeting */}
              <header className="flex flex-col gap-4">
                <p className="text-base font-medium text-[rgba(255,255,255,0.5)] mix-blend-plus-lighter">
                  <Ph>date-longue</Ph>
                </p>
                <h1 className="text-display font-medium leading-[1.1] tracking-tight text-white">
                  <Ph>greeting</Ph>, <Ph>prenom-user</Ph>.
                </h1>
                <p className="max-w-[640px] text-md leading-[1.5] text-[rgba(255,255,255,0.7)]">
                  <Ph>summary-jour-1</Ph> <Ph>summary-jour-2</Ph> <Ph>summary-jour-3</Ph>
                </p>
              </header>

              {/* Hero — focus du jour */}
              <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
                className="relative flex flex-col gap-6 rounded-xl p-10 vision-glass transition-transform duration-500 hover:-translate-y-1 preserve-3d"
              >
                <div className="relative flex items-baseline justify-between">
                  <span className="text-sm font-medium text-[rgba(255,255,255,0.5)]">
                    <Ph>hero-label</Ph>
                  </span>
                  <span className="text-sm text-[rgba(255,255,255,0.5)]">
                    <Ph>hero-meta</Ph>
                  </span>
                </div>
                <h2 className="relative max-w-[600px] text-2xl font-medium leading-[1.2] tracking-tight text-white">
                  <Ph>hero-title-ligne-1</Ph> <br />
                  <Ph>hero-title-ligne-2</Ph>
                </h2>
                <p className="relative max-w-[580px] text-base leading-[1.6] text-[rgba(255,255,255,0.7)]">
                  <Ph>hero-body-1</Ph> <Ph>hero-body-2</Ph>
                </p>
                <div className="relative flex items-center gap-4 pt-4">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    className="rounded-pill px-6 py-3 text-base transition-opacity hover:opacity-90 vision-btn-primary"
                  >
                    <Ph>hero-cta-primaire</Ph>
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    className="rounded-pill px-6 py-3 text-base transition-colors hover:bg-[rgba(255,255,255,0.12)] vision-btn-glass"
                  >
                    <Ph>hero-cta-secondaire</Ph>
                  </motion.button>
                </div>
              </motion.section>

              {/* Activité — liste avec toggle filtre */}
              <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col gap-6"
              >
                <div className="flex items-center justify-between px-2">
                  <h2 className="text-md font-medium tracking-tight text-white">
                    <Ph>activite-title</Ph>
                  </h2>
                  <div className="flex items-center gap-1 rounded-pill vision-segmented-track p-1">
                    {TOGGLE_OPTIONS.map((opt) => (
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        key={opt}
                        type="button"
                        onClick={() => setToggle(opt)}
                        aria-pressed={toggle === opt}
                        className={
                          toggle === opt
                            ? "rounded-pill px-5 py-2 text-sm font-medium text-white transition-all vision-btn-glass"
                            : "rounded-pill px-5 py-2 text-sm text-[rgba(255,255,255,0.5)] transition-colors hover:text-white"
                        }
                      >
                        <Ph>{opt}</Ph>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* TODO: filtrer activité par toggle */}
                <motion.ul
                  variants={LIST_VARIANTS}
                  initial="hidden"
                  animate="show"
                  className="flex flex-col gap-2"
                >
                  {[1, 2, 3, 4, 5].map((i) => (
                    <motion.li
                      variants={LIST_ITEM_VARIANTS}
                      key={i}
                      className="flex items-center gap-5 rounded-lg px-4 py-4 hover:bg-[rgba(255,255,255,0.04)] transition-colors"
                    >
                      <IconSlot />
                      <div className="flex flex-1 flex-col gap-1">
                        <span className="text-base font-medium text-white">
                          <Ph>activite-titre-{i}</Ph>
                        </span>
                        <span className="text-sm text-[rgba(255,255,255,0.5)]">
                          <Ph>activite-meta-{i}</Ph>
                        </span>
                      </div>
                      <span className="text-sm text-[rgba(255,255,255,0.4)]">
                        <Ph>ago-{i}</Ph>
                      </span>
                    </motion.li>
                  ))}
                </motion.ul>
              </motion.section>
            </motion.section>
          </main>

          {/* Fade noir en bas — marche de respiration entre scroll et pill footer */}
          <div
            aria-hidden
            className="pointer-events-none absolute bottom-0 left-0 right-0 z-20 h-60"
            style={{
              background:
                "linear-gradient(to bottom, transparent 0%, rgba(5,5,5,0.45) 25%, rgba(5,5,5,0.92) 60%, #050505 85%)",
            }}
          />

          <FloatingFooter />
        </div>

        <RightRail />
      </div>
    </div>
  );
}
