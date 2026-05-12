"use client";

import { useRouter } from "next/navigation";
import { Action } from "./components/ui";

export default function UserNotFound() {
  const router = useRouter();

  return (
    <div
      className="h-full w-full flex items-center justify-center"
      style={{ padding: "var(--space-8)" }}
    >
      <div
        className="flex flex-col items-center text-center"
        style={{ gap: "var(--space-4)", maxWidth: "480px" }}
      >
        <span className="t-9 font-mono tabular-nums text-text-faint">404</span>
        <h1 className="t-28 font-light text-text" style={{ margin: 0 }}>
          Page introuvable
        </h1>
        <p className="t-13 font-light text-text-muted" style={{ margin: 0 }}>
          Cette URL n&apos;existe pas (ou plus). Lance le Commandeur (⌘K) pour naviguer, ou retourne au cockpit.
        </p>
        <div className="flex items-center" style={{ gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
          <Action variant="secondary" tone="neutral" size="sm" onClick={() => router.back()}>
            Retour
          </Action>
          <Action variant="primary" tone="brand" size="sm" onClick={() => router.push("/")}>
            Retour au cockpit
          </Action>
        </div>
      </div>
    </div>
  );
}
