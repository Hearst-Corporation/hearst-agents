"use client";

/**
 * ContextRail — Rail droit polymorphe (post-pivot 2026-04-29).
 *
 * Dispatch selon `useStageStore.current.mode`. Chaque mode rend ses propres
 * sections directement — pas de sous-navigation à onglets, pas de composant
 * orchestrateur intermédiaire (RightPanelContent retiré du chemin critique).
 *
 * Règle « structure fixe par Stage » : chaque sub-rail rend SES sections
 * inconditionnellement, avec empty state interne. Pas de
 * `{section.length > 0 && ...}` autour d'un bloc complet.
 *
 * Invariant ADD I-2 : le `switch(mode)` est la source de vérité pour
 * cockpit/chat/asset/mission/browser/meeting/kg/voice/simulation/artifact/
 * asset_compare. Les overrides pathname (/runs, /missions, /apps,
 * /reports) sont traités AVANT le switch et ont priorité absolue.
 */

import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { useStageStore } from "@/stores/stage";
import {
  ContextRailForApps,
  ContextRailForMissionsAdmin,
  ContextRailForReports,
  ContextRailForRuns,
} from "./ContextRailForAdmin";
import { ContextRailForArtifact } from "./ContextRailForArtifact";
import { ContextRailForAsset } from "./ContextRailForAsset";
import { ContextRailForAssetCompare } from "./ContextRailForAssetCompare";
import { ContextRailForBrowser } from "./ContextRailForBrowser";
import { ContextRailForChat, ContextRailForCockpit } from "./ContextRailForCockpitChat";
import { ContextRailForKnowledge } from "./ContextRailForKnowledge";
import { ContextRailForMeeting } from "./ContextRailForMeeting";
import { ContextRailForMission } from "./ContextRailForMission";
import { ContextRailForPreMeeting } from "./ContextRailForPreMeeting";
import { ContextRailForSimulation } from "./ContextRailForSimulation";
import { ContextRailForVoice } from "./ContextRailForVoice";
import { ContextRailShell } from "./ContextRailShell";
import { usePreMeetingActive } from "./hooks/usePreMeetingActive";

interface ContextRailProps {
  onClose?: () => void;
}

export function ContextRail({ onClose }: ContextRailProps) {
  const pathname = usePathname();
  const mode = useStageStore((s) => s.current.mode);
  const preMeetingActive = usePreMeetingActive();

  // Pages standalone : sub-rails admin overrident le mode du Stage central.
  // Promesse pivot 2026-04-29 « structure fixe par Stage » étendue aux pages
  // admin pour qu'elles aient un contexte pertinent au lieu du dashboard
  // générique du Cockpit.
  if (pathname?.startsWith("/runs")) {
    return (
      <ContextRailShell onClose={onClose}>
        <ContextRailForRuns />
      </ContextRailShell>
    );
  }
  if (pathname?.startsWith("/missions")) {
    return (
      <ContextRailShell onClose={onClose}>
        <ContextRailForMissionsAdmin />
      </ContextRailShell>
    );
  }
  if (pathname?.startsWith("/apps")) {
    return (
      <ContextRailShell onClose={onClose}>
        <Suspense>
          <ContextRailForApps />
        </Suspense>
      </ContextRailShell>
    );
  }
  if (pathname?.startsWith("/reports")) {
    return (
      <ContextRailShell onClose={onClose}>
        <ContextRailForReports />
      </ContextRailShell>
    );
  }

  // Pre-Meeting Intel — override sur cockpit/chat uniquement, et seulement
  // si une notif pre_meeting non-lue récente est active (créée par le job
  // Inngest 25-35min avant l'event). Pas affiché sur les autres modes pour
  // ne pas casser leur structure fixe.
  if (preMeetingActive && (mode === "cockpit" || mode === "chat")) {
    return (
      <ContextRailShell onClose={onClose}>
        <ContextRailForPreMeeting
          eventTitle={preMeetingActive.eventTitle}
          meta={preMeetingActive.meta}
        />
      </ContextRailShell>
    );
  }

  switch (mode) {
    case "cockpit":
      return (
        <ContextRailShell onClose={onClose}>
          <ContextRailForCockpit />
        </ContextRailShell>
      );
    case "chat":
      return (
        <ContextRailShell onClose={onClose}>
          <ContextRailForChat />
        </ContextRailShell>
      );
    case "asset":
      return (
        <ContextRailShell onClose={onClose}>
          <ContextRailForAsset />
        </ContextRailShell>
      );
    case "mission":
      return (
        <ContextRailShell onClose={onClose}>
          <ContextRailForMission />
        </ContextRailShell>
      );
    case "browser":
      return (
        <ContextRailShell onClose={onClose}>
          <ContextRailForBrowser />
        </ContextRailShell>
      );
    case "meeting":
      return (
        <ContextRailShell onClose={onClose}>
          <ContextRailForMeeting />
        </ContextRailShell>
      );
    case "kg":
      return (
        <ContextRailShell onClose={onClose}>
          <ContextRailForKnowledge />
        </ContextRailShell>
      );
    case "voice":
      return (
        <ContextRailShell onClose={onClose}>
          <ContextRailForVoice />
        </ContextRailShell>
      );
    case "simulation":
      return (
        <ContextRailShell onClose={onClose}>
          <ContextRailForSimulation />
        </ContextRailShell>
      );
    case "artifact":
      return (
        <ContextRailShell onClose={onClose}>
          <ContextRailForArtifact />
        </ContextRailShell>
      );
    case "asset_compare":
      return (
        <ContextRailShell onClose={onClose}>
          <ContextRailForAssetCompare />
        </ContextRailShell>
      );
    default:
      return null;
  }
}
