"use client";

/**
 * HelmShell — wrapper CockpitShell pour Hearst OS (helm).
 *
 * Utilisé dans `app/(user)/layout.tsx` uniquement (zone authentifiée).
 * Le root layout reste volontairement sans shell pour ne pas interférer
 * avec les routes publiques et la page login.
 */

import { CockpitShell } from "@hearst/cockpit-shell";
import type { ReactNode } from "react";
import { HelmBottomBar } from "./HelmBottomBar";

const HELM_PRODUCTS = [
  { id: "helm", name: "Hearst OS", short: "OS", color: "#8A1538" },
] satisfies import("@hearst/cockpit-shell").CockpitProduct[];

export function HelmShell({ children }: { children: ReactNode }) {
  return (
    <CockpitShell products={HELM_PRODUCTS} appId="helm" bottomBar={<HelmBottomBar />}>
      {children}
    </CockpitShell>
  );
}
