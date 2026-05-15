import { loadCC } from "@/lib/hom/cc-state";
import { CommandCenterLive } from "../_components/CommandCenterLive";
import { HomShell, PageHeader } from "../_components/Shell";

export const dynamic = "force-dynamic";

export default async function CommandCenterPage() {
  const initial = await loadCC();
  return (
    <HomShell current="/admin/orchestrator/command-center">
      <PageHeader
        title="Command Center"
        subtitle="Pilotage live du mesh — état temps réel via SSE."
      />
      <CommandCenterLive initial={initial} />
    </HomShell>
  );
}
