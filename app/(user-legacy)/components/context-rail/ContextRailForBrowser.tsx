"use client";

/**
 * Sub-rail Stage "browser" — info Stagehand / Take Over.
 */

import { Section } from "./Section";

export function ContextRailForBrowser() {
  return (
    <div className="h-full overflow-y-auto">
      <Section label="Co-pilot">
        <p className="t-13 font-light text-text-faint leading-relaxed">
          Agent navigating in the live session. Take Over coming with Stagehand.
        </p>
      </Section>
    </div>
  );
}
