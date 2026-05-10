/**
 * RailHeader — bloc logo en tête du rail.
 *
 * Invariant I-10 : logo Hearst intouchable. Expanded → <HearstLogo />,
 * collapsed → caractère "H" en teal sourd avec halo-cyan-sm. Click →
 * handleHome (= setActiveThread(null) + setStageMode cockpit).
 */

import { HearstLogo } from "../HearstLogo";

export interface RailHeaderProps {
  collapsed: boolean;
  onHome: () => void;
}

export function RailHeader({ collapsed, onHome }: RailHeaderProps) {
  return (
    <div
      className="shrink-0 flex items-center justify-center pt-8 pb-8 px-8"
      style={{
        boxShadow: "var(--shadow-divider-bottom-subtle)",
      }}
    >
      <button
        onClick={onHome}
        className="flex items-center justify-center hover:opacity-80 transition-opacity"
        title="Hearst"
      >
        {collapsed ? (
          <span className="t-15 font-medium tracking-tight text-(--accent-teal) halo-cyan-sm leading-none">
            H
          </span>
        ) : (
          <HearstLogo className="h-10 w-auto transition-all duration-slow" />
        )}
      </button>
    </div>
  );
}
