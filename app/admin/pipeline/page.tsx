/**
 * Admin Pipeline — canvas SSE live + replay.
 *
 * Le canvas est entièrement client (CanvasShell + sous-composants `_canvas/`).
 * Cette page sert de hôte de routing : layout admin (sidebar/topbar) gère
 * l'auth + KPI strip ; la page n'expose que la frame du canvas.
 */

import CanvasShell from "../_canvas/CanvasShell";

export const dynamic = "force-dynamic";

export default function AdminPipelinePage() {
  return <CanvasShell />;
}
