"use client";

import { Suspense } from "react";
import { ConnectionsHub } from "../components/ConnectionsHub";
import { ScreenShell } from "../components/ui";

export default function AppsPage() {
  return (
    <ScreenShell
      title="Apps"
      subtitle="Catalogue des intégrations disponibles. Connectez les sources qui alimentent vos rapports et missions."
      breadcrumb={[{ label: "Hearst", href: "/" }, { label: "Apps" }]}
    >
      <Suspense>
        <ConnectionsHub />
      </Suspense>
    </ScreenShell>
  );
}
