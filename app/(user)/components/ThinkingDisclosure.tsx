"use client";

import { useState } from "react";
import { Chip } from "@/app/(user)/components/ui/Chip";

interface ThinkingDisclosureProps {
  thinking: string;
}

export function ThinkingDisclosure({ thinking }: ThinkingDisclosureProps) {
  const [open, setOpen] = useState(false);
  const lines = thinking.trim().split("\n").length;

  return (
    <details
      open={open}
      className="mb-3 border-l-2 border-(--warn)/40 bg-surface-1 rounded-sm"
      style={{ padding: "var(--space-3) var(--space-4)" }}
    >
      <summary
        className="flex items-center cursor-pointer list-none select-none"
        style={{ gap: "var(--space-2)" }}
        onClick={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
      >
        <Chip
          variant="dot"
          className={open ? "bg-(--warn) animate-pulse" : "bg-(--accent-teal)"}
          aria-hidden
        />
        <span className="t-11 font-medium text-(--warn)">RAISONNEMENT · {lines} lignes</span>
      </summary>
      <pre
        className="t-11 font-mono text-text-faint whitespace-pre-wrap overflow-x-auto"
        style={{ padding: "var(--space-4)", maxHeight: "var(--space-64)", overflow: "auto" }}
      >
        {thinking}
      </pre>
    </details>
  );
}
