"use client";

import { useSession } from "next-auth/react";

export function OrbitalGreeting() {
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(" ")[0] ?? "";
  const greeting = firstName ? `Bonjour, ${firstName}.` : "Bonjour.";

  return (
    <div
      className="shrink-0 flex flex-col items-center pt-12 pb-4 gap-2 relative z-10 rounded-2xl overflow-hidden backdrop-blur-md bg-bg-gradient-radial-subtle bg-bg-gradient-linear-bottom-glow animate-fade-in-slide-up-subtle"
    >
      <h1
        className="font-extralight t-48 tracking-editorial text-text-l0 leading-tight text-shadow-subtle-accent animate-fade-in-slide-up-subtle"
      >
        {greeting}
      </h1>
      <p
        className="font-light t-15 tracking-subtle text-text-faint animate-fade-in-slide-up-subtle"
      >
        Voici ce qui se passe pour toi.
      </p>
    </div>
  );
}
