// lint-visual-disable-file — prototype luxe orbital, palette ad-hoc hors DS
"use client";

import { useSession } from "next-auth/react";

export function OrbitalGreeting() {
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(" ")[0] ?? "";
  const greeting = firstName ? `Bonjour, ${firstName}.` : "Bonjour.";

  return (
    <div
      className="shrink-0 flex flex-col items-center"
      style={{ paddingTop: 48, paddingBottom: 16, gap: 8 }}
    >
      <h1
        className="font-extralight"
        style={{
          fontSize: "3rem",
          letterSpacing: "-0.04em",
          color: "rgba(255,255,255,0.92)",
          lineHeight: 1,
        }}
      >
        {greeting}
      </h1>
      <p
        className="font-light"
        style={{
          fontSize: "1rem",
          color: "rgba(255,255,255,0.38)",
          letterSpacing: "0.01em",
        }}
      >
        Que souhaitez-vous orchestrer aujourd&apos;hui&nbsp;?
      </p>
    </div>
  );
}
