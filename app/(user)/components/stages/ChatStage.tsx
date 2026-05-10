"use client";

import { useFocalStore } from "@/stores/focal";
import { useNavigationStore } from "@/stores/navigation";
import { useRuntimeStore } from "@/stores/runtime";
import { useWorkingDocumentStore } from "@/stores/working-document";
import { ChatMessages } from "../ChatMessages";
import { Breadcrumb, type Crumb } from "../Breadcrumb";
import { RunProgressBanner } from "../RunProgressBanner";
import { FocalStage } from "../FocalStage";
import { MissionStepGraph } from "../MissionStepGraph";
import { WelcomePanel } from "../WelcomePanel";
import { ConversationHeader } from "../chat/ConversationHeader";
import { WorkingDocument } from "../chat/WorkingDocument";
import type { Message } from "@/lib/core/types";

interface ChatStageProps {
  messages: Message[];
  hasMessages: boolean;
  onSubmit: (message: string) => Promise<void>;
  hasMessagesPlaceholder?: never;
}

/**
 * ChatStage — Conversation classique + Thinking Canvas (split view).
 *
 * Lot C — la "Thinking Canvas" se compose de :
 *   - Chat à gauche (ChatMessages, flex-1)
 *   - WorkingDocument à droite (rendu si `useWorkingDocumentStore.isOpen`,
 *     width `min(50%, 720px)`)
 *
 * Le focal stage (brief / report / asset preview) reste compatible : si un
 * focal est ouvert, il prend le haut de la zone chat, ChatMessages descend
 * en bas (collapsed 320px). Le WorkingDocument vit À DROITE de l'ensemble
 * focal+chat — il est plus prioritaire dans la roadmap (brouillon expandé
 * d'un block) et n'écrase pas le focal (contenu fini).
 *
 * Hotkey ⌘B : géré globalement dans `useGlobalHotkeys` → toggle WorkingDocument.
 */
export function ChatStage({ messages, hasMessages, onSubmit }: ChatStageProps) {
  const focal = useFocalStore((s) => s.focal);
  const isFocalVisible = useFocalStore((s) => s.isVisible);
  const showFocalStage = useFocalStore((s) => s.show);
  const hideFocalStage = useFocalStore((s) => s.hide);
  const activeThreadId = useNavigationStore((s) => s.activeThreadId);
  const activeThread = useNavigationStore((s) =>
    activeThreadId ? s.threads.find((t) => t.id === activeThreadId) : undefined,
  );
  const isWorkingDocOpen = useWorkingDocumentStore((s) => s.isOpen);
  // Phase B5 : expose le plan multi-step en cours dans le ChatStage. Avant,
  // seul MissionStage rendait le StepGraph — un user qui lance un plan
  // depuis le chat ne voyait que RunProgressBanner (1 ligne). Maintenant
  // le plan complet est visible en bandeau supérieur quand actif.
  const currentPlan = useRuntimeStore((s) => s.currentPlan);

  const focalVisible = !!focal && isFocalVisible;

  return (
    <div className="flex-1 flex min-h-0 relative" style={{ background: "var(--surface)" }}>
      {/* Pane gauche — chat (+ focal embedded). Largeur fluide :
          flex-1 quand split actif, max-w-[var(--width-center-max)] sinon. */}
      <div className="flex-1 flex flex-col min-h-0 relative min-w-0">
        {activeThreadId && <ConversationHeader />}
        {currentPlan && (
          <div
            className="flex-shrink-0 border-b border-(--border-default)"
            style={{ padding: "var(--space-4) var(--space-12)" }}
          >
            <MissionStepGraph plan={currentPlan} />
          </div>
        )}

        {focalVisible && focal && (() => {
          const threadLabel = activeThread?.name?.trim() ?? "";
          const titleLabel = focal.title?.trim() ?? "";
          const looksLikeDuplicate =
            !!threadLabel &&
            !!titleLabel &&
            (titleLabel.toLowerCase().includes(threadLabel.toLowerCase()) ||
              threadLabel.toLowerCase().includes(titleLabel.toLowerCase().slice(0, 32)));
          const focalTypeLabel = (focal.type ?? "DOC").toUpperCase();
          const trail: Crumb[] = looksLikeDuplicate
            ? [{ label: focalTypeLabel }, { label: focal.title, accent: true }]
            : [{ label: threadLabel || "Hearst" }, { label: focalTypeLabel }, { label: focal.title, accent: true }];

          return (
            <div className="flex flex-col min-h-0 border-b border-(--border-default) bg-gradient-to-b from-[var(--surface-1)] to-transparent" style={{ maxHeight: "60%" }}>
              <div className="flex items-center justify-between px-12 py-6 flex-shrink-0 relative z-10 border-b border-(--border-default)">
                <Breadcrumb trail={trail} className="min-w-0 truncate" />
                <button
                  onClick={hideFocalStage}
                  className="inline-flex items-center gap-2 px-3 py-1.5 t-11 font-light border border-(--border-shell) text-text-faint hover:text-(--accent-teal) hover:border-[var(--accent-teal-border-hover)] transition-colors shrink-0"
                  title="Close (Esc)"
                >
                  <span>Close</span>
                  <span className="t-9 font-mono tabular-nums opacity-60">ESC</span>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0">
                <FocalStage />
              </div>
            </div>
          );
        })()}

        {focal && !isFocalVisible && (
          <div className="flex-shrink-0 px-12 py-8 relative z-10">
            <button onClick={showFocalStage} className="inline-flex items-center gap-6 group">
              <span className="rounded-pill bg-(--accent-teal) animate-pulse halo-dot" style={{ width: "var(--space-2)", height: "var(--space-2)" }} />
              <div className="flex flex-col items-start">
                <span className="t-11 font-light text-text-faint group-hover:text-(--accent-teal)  transition-colors">
                  {focal.type === "brief" ? "Active Brief" : focal.type === "report" ? "Active Report" : "Active Document"}
                </span>
                <span className="t-15 font-medium tracking-tight text-text-muted group-hover:translate-x-1 group-hover:text-text transition-[transform,color] duration-(--duration-slow)">
                  {focal.title}
                </span>
              </div>
            </button>
          </div>
        )}

        {!hasMessages && !focal && <WelcomePanel />}

        {hasMessages && (
          <div className={focalVisible ? "flex-shrink-0 border-t border-(--border-default) bg-gradient-to-b from-[var(--surface-1)] to-transparent" : "flex-1 min-h-0 bg-bg-elev"} style={focalVisible ? { height: "var(--height-chat-collapsed)" } : undefined}>
            {/* Padding uniforme px-12 py-8 dans les 2 états (focal visible/caché) — évite le saut horizontal de 40px↔48px */}
            <ChatMessages
              messages={messages}
              compact={focalVisible}
              className="h-full overflow-y-auto px-12 py-8 flex flex-col min-h-0"
              onQuickReply={onSubmit}
            />
          </div>
        )}

        <RunProgressBanner />
      </div>

      {/* Pane droite — WorkingDocument (rendu uniquement si isOpen). */}
      {isWorkingDocOpen && <WorkingDocument />}
    </div>
  );
}
