const fs = require("fs");

const path = "lab/cli-os/src/scenes/CockpitScene.tsx";
let content = fs.readFileSync(path, "utf8");

// 1. Layout: Left rail
content = content.replace(
  /<aside className="flex w-\[72px\] flex-col items-center gap-1 bg-\[var\(--color-bg-elev-1\)\] py-6">/,
  '<aside className="flex w-[56px] flex-col items-center gap-1 bg-[var(--color-bg-elev-1)] py-6">',
);

// 2. Layout: Center
content = content.replace(
  /<motion\.section\n\s*initial=\{\{ opacity: 0, y: 12 \}\}\n\s*animate=\{\{ opacity: 1, y: 0 \}\}\n\s*transition=\{\{ duration: 0\.4, ease: \[0\.22, 1, 0\.36, 1\] \}\}\n\s*className="flex w-full max-w-\[820px\] flex-col gap-14"\n\s*>/,
  '<motion.section\n            initial={{ opacity: 0, y: 12 }}\n            animate={{ opacity: 1, y: 0 }}\n            transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}\n            className="flex w-full max-w-[720px] flex-col gap-14"\n          >',
);

// 3. Typo: Greeting tracking
content = content.replace(
  /className="text-\[length:var\(--text-cap\)\] uppercase tracking-\[0\.2em\] text-\[var\(--color-fg-mute\)\]"/,
  'className="text-[length:var(--text-cap)] uppercase tracking-[0.08em] text-[var(--color-fg-mute)]"',
);

// 4. Typo: Greeting H1 size
content = content.replace(
  /className="text-\[44px\] font-medium leading-\[1\.05\] tracking-\[-0\.025em\] text-\[var\(--color-ink-strong\)\]"/,
  'className="text-[32px] font-medium leading-[1.05] tracking-[-0.025em] text-[var(--color-ink-strong)]"',
);

// 5. Hero Motion + Bug Fix
const oldHero = `<motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="relative flex flex-col gap-5 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-bg-elev-1)] p-8"
            >
              {/* Gradient ambient discret */}
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-32 opacity-50"
                style={{
                  background:
                    "radial-gradient(60% 80% at 20% 0%, var(--color-accent-faint) 0%, transparent 70%)",
                }}
              />
              <div className="relative flex items-baseline justify-between">
                <span className="text-[length:var(--text-cap)] uppercase tracking-[0.18em] text-[var(--color-fg-mute)]">`;

const newHero = `<motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.08, ease: [0.34, 1.56, 0.64, 1] }}
              className="relative flex flex-col gap-5 rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-bg-elev-1)] p-8"
            >
              {/* Gradient ambient discret isolé */}
              <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[var(--radius-lg)]">
                <div
                  className="absolute inset-x-0 top-0 h-32 opacity-50"
                  style={{
                    background:
                      "radial-gradient(60% 80% at 20% 0%, var(--color-accent-faint) 0%, transparent 70%)",
                  }}
                />
              </div>
              <div className="relative flex items-baseline justify-between">
                <span className="text-[length:var(--text-cap)] uppercase tracking-[0.08em] text-[var(--color-fg-mute)]">`;

content = content.replace(oldHero, newHero);

// 6. Hero H2 with vertical bar
const oldHeroH2 = `<h2 className="relative max-w-[600px] text-[28px] font-medium leading-[1.15] tracking-[-0.015em] text-[var(--color-ink-strong)]">
                <Ph>hero-title-ligne-1</Ph> <Ph>hero-title-ligne-2</Ph>
              </h2>`;

const newHeroH2 = `<h2 className="relative flex items-center gap-2 max-w-[600px] text-[28px] font-medium leading-[1.15] tracking-[-0.015em] text-[var(--color-ink-strong)]">
                <span className="inline-block h-5 w-px bg-[var(--color-border-strong)] shrink-0" />
                <span><Ph>hero-title-ligne-1</Ph> <Ph>hero-title-ligne-2</Ph></span>
              </h2>`;

content = content.replace(oldHeroH2, newHeroH2);

// 7. Activité Motion
content = content.replace(
  /<motion\.section\n\s*initial=\{\{ opacity: 0, y: 8 \}\}\n\s*animate=\{\{ opacity: 1, y: 0 \}\}\n\s*transition=\{\{ duration: 0\.4, delay: 0\.16, ease: \[0\.22, 1, 0\.36, 1\] \}\}/,
  "<motion.section\n              initial={{ opacity: 0, y: 8 }}\n              animate={{ opacity: 1, y: 0 }}\n              transition={{ duration: 0.4, delay: 0.16, ease: [0.34, 1.56, 0.64, 1] }}",
);

// 8. Right rail layout & tracking
const oldRightRail = `<aside className="flex w-[260px] flex-col gap-1 border-l border-[var(--color-border-soft)] px-5 py-12">
          <h3 className="mb-2 text-[length:var(--text-cap)] uppercase tracking-[0.18em] text-[var(--color-fg-mute)]">`;
const newRightRail = `<aside className="flex w-[200px] flex-col gap-1 border-l border-[var(--color-border-soft)] px-5 py-12">
          <h3 className="mb-2 text-[length:var(--text-cap)] uppercase tracking-[0.08em] text-[var(--color-fg-mute)]">`;

content = content.replace(oldRightRail, newRightRail);

// 9. Footer chips left
const oldFooterLeft = `className="flex items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--color-border-soft)] bg-[var(--color-bg-elev-2)] px-4 py-2 text-[length:var(--text-sm)] text-[var(--color-fg-dim)] transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-elev-3)] hover:text-[var(--color-ink)]"`;
const newFooterLeft = `className="flex items-center gap-2 rounded-[var(--radius-pill)] bg-transparent px-4 py-2 text-[length:var(--text-sm)] text-[var(--color-fg-dim)] transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-[var(--color-ink)]"`;
content = content.replace(oldFooterLeft, newFooterLeft);

// 10. Footer chips right
const oldFooterRight = `className="flex items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-bg-elev-3)] px-4 py-2 text-[length:var(--text-sm)] font-medium text-[var(--color-ink-strong)] transition-colors hover:bg-[var(--color-bg-elev-2)]"`;
const newFooterRight = `className="group flex items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-ink)] px-4 py-2 text-[length:var(--text-sm)] font-medium text-[var(--color-bg)] transition-all hover:bg-white hover:opacity-95"`;
content = content.replace(oldFooterRight, newFooterRight);

fs.writeFileSync(path, content, "utf8");
