"use client";

import { CockpitShell } from "@hearst/cockpit-shell";
import type { ReactNode } from "react";

const HELM_PRODUCTS = [{ id: "helm" as const, name: "Hearst Helm", short: "HE", color: "#2ECFCE" }];

export function HelmShell({ children }: { children: ReactNode }) {
  return (
    <CockpitShell products={HELM_PRODUCTS} appId="helm">
      {children}
    </CockpitShell>
  );
}
