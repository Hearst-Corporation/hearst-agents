"use client";

import { Suspense } from "react";
import { ConnectionsHub } from "../components/ConnectionsHub";
import { ScreenShell } from "../components/ui";

export default function AppsPage() {
  return (
    <ScreenShell
      title="Apps"
      subtitle="Connecte les sources qui nourrissent tes reports et missions."
      breadcrumb={[{ label: "Hearst", href: "/" }, { label: "Apps" }]}
    >
      <Suspense>
        <ConnectionsHub />
      </Suspense>
    </ScreenShell>
  );
}
