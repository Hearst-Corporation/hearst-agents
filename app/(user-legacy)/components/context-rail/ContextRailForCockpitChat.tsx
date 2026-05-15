"use client";

/**
 * Sub-rails cockpit / chat — exposent `CockpitChatBody` (5 strates
 * immuables via <GeneralDashboard>) ainsi que `ContextRailForCockpit`
 * et `ContextRailForChat` qui le rendent à l'identique.
 *
 * Refonte 2026-05-04 v3 : les 6 quick tiles bas (chat/voice/mission/
 * assets/reports/apps) ont été retirées. Les actions équivalentes vivent
 * dans la Strate 3 du <GeneralDashboard> (4 CTA : Nouvelle mission /
 * Nouveau rapport / Ajouter une source / Lancer analyse). L'accès direct
 * aux autres Stages reste disponible via Cmd+K (Commandeur) et hotkeys
 * ⌘1-9 (cf. STAGE_HOTKEYS).
 *
 * Invariant ADD I-8 : 5 strates dans l'ordre, jamais de réordonnancement
 * ni d'ajout de strate sans mise à jour de spec.
 *
 * Spec : [docs/screens/right-panel-dashboard.md](docs/screens/right-panel-dashboard.md)
 */

import { GeneralDashboard } from "../right-panel/GeneralDashboard";

function CockpitChatBody() {
  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-hide">
        <GeneralDashboard />
      </div>
    </div>
  );
}

export function ContextRailForCockpit() {
  return <CockpitChatBody />;
}

export function ContextRailForChat() {
  return <CockpitChatBody />;
}
