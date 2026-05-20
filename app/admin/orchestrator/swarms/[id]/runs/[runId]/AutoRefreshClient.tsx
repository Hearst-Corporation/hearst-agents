"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface AutoRefreshClientProps {
  /** Polling interval in milliseconds (default: 3000). */
  intervalMs?: number;
}

/**
 * Client component: refreshes the server component subtree on a fixed interval
 * by calling router.refresh(). Rendered only when the run is in a live state.
 */
export function AutoRefreshClient({ intervalMs = 3000 }: AutoRefreshClientProps) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
