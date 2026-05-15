"use client";

import { Suspense } from "react";
import { ConnectionsHub } from "../components/ConnectionsHub";
import { ScreenShell } from "../components/ui";

export default function AppsPage() {
  return (
    <ScreenShell
      title="Sources"
      subtitle="Connecte les apps qui nourrissent tes missions et productions."
      breadcrumb={[{ label: "Hearst", href: "/" }, { label: "Sources" }]}
    >
      <Suspense>
        <ConnectionsHub />
      </Suspense>
    </ScreenShell>
  );
}
