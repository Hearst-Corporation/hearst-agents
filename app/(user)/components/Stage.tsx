"use client";

/**
 * @deprecated Ce routeur legacy n'est plus monté dans l'app depuis le
 * pivot shell visionOS (P4). Le routing des stages est désormais géré par
 * `CockpitXClient` + `app/(user)/_stages/*` + `useStageStore`.
 *
 * Conservé temporairement pour compatibilité des tests legacy
 * (`__tests__/stores/stage-routing.test.tsx`). Ne pas modifier — supprimer
 * quand les tests auront migré vers le nouveau registry.
 */

import type { CockpitTodayPayload } from "@/lib/cockpit/today";
import type { Message } from "@/lib/core/types";
import { useStageStore } from "@/stores/stage";
import { ArtifactStage } from "./stages/ArtifactStage";
import { AssetCompareStage } from "./stages/AssetCompareStage";
import { AssetStage } from "./stages/AssetStage";
import { BrowserStage } from "./stages/BrowserStage";
import { ChatStage } from "./stages/ChatStage";
import { CockpitStage } from "./stages/CockpitStage";
import { KnowledgeStage } from "./stages/KnowledgeStage";
import { MeetingStage } from "./stages/MeetingStage";
import { MissionStage } from "./stages/MissionStage";
import { SignalBoardStage } from "./stages/SignalBoardStage";
import { SimulationStage } from "./stages/SimulationStage";
import { VoiceStage } from "./stages/VoiceStage";

interface StageProps {
  /** Messages du thread actif (utilisé par ChatStage). */
  messages: Message[];
  /** Handler quick-reply (consommé par ChatMessages). */
  onSubmit: (message: string) => Promise<void>;
  hasMessages: boolean;
  /**
   * Phase C5 — payload Cockpit pré-fetché côté serveur. Transmis à
   * CockpitStage pour skip son fetch initial → gain LCP. Null = client
   * fait son fetch normal en fallback.
   */
  initialCockpitData?: CockpitTodayPayload | null;
}

/**
 * Stage — Router polymorphe central.
 *
 * Rend le sub-Stage approprié selon `useStageStore.current.mode`.
 */
export function Stage(props: StageProps) {
  const current = useStageStore((s) => s.current);

  switch (current.mode) {
    case "cockpit":
      return <CockpitStage initialData={props.initialCockpitData ?? null} />;
    case "chat":
      return (
        <ChatStage
          messages={props.messages}
          hasMessages={props.hasMessages}
          onSubmit={props.onSubmit}
        />
      );
    case "asset":
      return <AssetStage assetId={current.assetId} variantKind={current.variantKind} />;
    case "asset_compare":
      return <AssetCompareStage assetIds={current.assetIds} />;
    case "mission":
      return <MissionStage missionId={current.missionId} />;
    case "browser":
      return <BrowserStage sessionId={current.sessionId} />;
    case "meeting":
      return <MeetingStage meetingId={current.meetingId} />;
    case "kg":
      return <KnowledgeStage entityId={current.entityId} query={current.query} />;
    case "voice":
      return <VoiceStage sessionId={current.sessionId} />;
    case "simulation":
      return <SimulationStage />;
    case "artifact":
      return (
        <ArtifactStage
          artifactId={current.artifactId}
          initialCode={current.code}
          initialLanguage={current.language}
        />
      );
    case "signal":
      return <SignalBoardStage />;
    default:
      return null;
  }
}
