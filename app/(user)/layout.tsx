"use client";

import { useEffect, Suspense } from "react";
import { SessionProvider } from "next-auth/react";
import { LeftPanelShell } from "./components/LeftPanelShell";
import { RightPanel } from "./components/RightPanel";
import { Commandeur } from "./components/Commandeur";
import { ChatDock } from "./components/ChatDock";
import { StageFooter } from "./components/StageFooter";
import { PulseBar } from "./components/PulseBar";
import { MobileBottomNav } from "./components/MobileBottomNav";
import { VoicePulse } from "./components/voice/VoicePulse";
import { FocusBadge } from "./components/FocusBadge";
import { VideoQuickLaunch } from "./components/VideoQuickLaunch";
import { ToastContainer } from "@/app/components/ToastContainer";
import { useToast } from "@/app/hooks/use-toast";
import { useGlobalHotkeys } from "@/app/hooks/use-global-hotkeys";
import { useVoiceStore } from "@/stores/voice";
import { useNotificationsStore } from "@/stores/notifications";
import { useFocusMode } from "@/stores/focus-mode";

function BriefingAutoTrigger() {
  useEffect(() => {
    const h = new Date().getHours();
    if (h >= 6 && h <= 10) {
      void fetch("/api/briefing", { method: "POST" }).catch(() => {});
    }
  }, []);
  return null;
}

function ToastProvider({ children }: { children: React.ReactNode }) {
  const { toasts, dismiss } = useToast();
  return (
    <>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </>
  );
}

/**
 * VoiceMount — Mount conditionnel du pipeline WebRTC voix.
 *
 * Vit au root layout pour ne JAMAIS unmount lors de la navigation entre
 * Stages. La connexion OpenAI Realtime ne s'ouvre que quand
 * `useVoiceStore.voiceActive` passe à true (déclenché par ⌘7, ⌘⇧V, ou
 * Commandeur). Avant : VoicePulse était dans VoiceStage → mount/unmount
 * à chaque navigation → 14 sessions accumulées + 4 agents qui parlaient
 * en chœur.
 */
function VoiceMount() {
  const voiceActive = useVoiceStore((s) => s.voiceActive);
  if (!voiceActive) return null;
  return <VoicePulse />;
}

/**
 * NotificationsHydrate — Hydrate le store notifications dès le mount du
 * layout pour que le badge NotificationBell affiche le compte initial sans
 * attendre l'ouverture du dropdown. Le polling/realtime continuera ensuite
 * via NotificationBell lui-même.
 */
function NotificationsHydrate() {
  const fetchNotifications = useNotificationsStore((s) => s.fetchNotifications);
  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);
  return null;
}

/**
 * UserLayout — Post-pivot 2026-04-29.
 *
 * Layout cockpit :
 *   PulseBar (top fixed, état système + jobs + voice + credits)
 *   ┌──────────┬───────────────────────────────────┬──────────┐
 *   │ Timeline │  Stage polymorphe (page.tsx)      │ Context  │
 *   │   Rail   │                                   │   Rail   │
 *   └──────────┴───────────────────────────────────┴──────────┘
 *   Commandeur (overlay Cmd+K, monté toujours, hidden if !isOpen)
 *
 * useGlobalHotkeys branche les raccourcis : Cmd+K, Cmd+1..7
 * (cockpit/chat/asset/browser/meeting/kg/voice), Cmd+Backspace.
 */
export default function UserLayout({ children }: { children: React.ReactNode }) {
  useGlobalHotkeys();
  const focusMode = useFocusMode((s) => s.enabled);

  return (
    <SessionProvider>
      <BriefingAutoTrigger />
      <NotificationsHydrate />
      <ToastProvider>
        <div
          className="shell-bg h-screen w-full flex flex-col overflow-hidden"
          style={{ color: "var(--text)" }}
        >
          {/* Electron titlebar drag region — zone 32px fixe en haut qui reste
              toujours draggable. pointer-events:none laisse les clics passer
              aux boutons du PulseBar. */}
          <div className="electron-titlebar" aria-hidden />

          {/* PulseBar — top fixed, état système + Cmd+K + voice + notifications.
             Focus Mode (S4-B) : rétracté hors écran via translateY(-100%) pour
             laisser le Stage prendre 100vh (animation slow + ease-standard). */}
          <div
            className="shell-card mx-4 mt-4 mb-4"
            style={{
              transform: focusMode ? "translateY(-100%)" : "translateY(0)",
              maxHeight: focusMode ? "0" : "var(--height-pulsebar)",
              overflow: "hidden",
              transition:
                "transform var(--duration-slow) var(--ease-standard), max-height var(--duration-slow) var(--ease-standard)",
            }}
          >
            <PulseBar />
          </div>

          {/* Row 3 colonnes : TimelineRail / Stage / ContextRail
             Pivot UI 2026-05-03 : le Stage central devient une carte
             détachée — radius lg, shadow douce, padding shell vertical
             16px (top + bot). Les rails restent bord-à-bord. Mobile :
             pb-20 préservé pour MobileBottomNav.
             Focus Mode (S4-B) : les Rails passent à width 0 avec animation,
             le Stage prend tout l'espace via flex-1. */}
          <div
            className="flex-1 flex min-h-0 w-full overflow-hidden pb-20 md:pb-0"
            style={{ color: "var(--text)" }}
          >
            <div
              aria-hidden={focusMode}
              className="shell-rail ml-4 mb-4"
              style={{
                width: focusMode ? "0" : "auto",
                overflow: "hidden",
                flexShrink: 0,
                transition: "width var(--duration-slow) var(--ease-standard)",
                pointerEvents: focusMode ? "none" : "auto",
              }}
            >
              <LeftPanelShell />
            </div>

            <div
              className="shell-card flex-1 flex flex-col min-w-0 min-h-0 relative overflow-hidden mx-4 mb-4"
              style={{
                color: "var(--text)",
                transition: "box-shadow var(--duration-slow) var(--ease-standard)",
              }}
            >
              {/* Alerte tokens OAuth expirants : badge dot sur l'item Apps de
                 la TimelineRail (cf. useOAuthExpiry). Pas de banner global
                 — le signal vit dans le rail. */}
              <main className="flex-1 flex flex-col min-w-0 min-h-0 relative">
                {children}
              </main>
              {/* ChatDock utilise useSearchParams() — wrapper Suspense
                  obligatoire pour le build static (Next.js 16). */}
              <Suspense fallback={null}>
                <ChatDock />
              </Suspense>
            </div>

            <div
              aria-hidden={focusMode}
              className="shell-rail mr-4 mb-4"
              style={{
                width: focusMode ? "0" : "auto",
                overflow: "hidden",
                flexShrink: 0,
                transition: "width var(--duration-slow) var(--ease-standard)",
                pointerEvents: focusMode ? "none" : "auto",
              }}
            >
              <RightPanel />
            </div>
          </div>

          {/* StageFooter — full-width sous les 3 colonnes. Sorti du div
             central pour ne pas hériter des bordures border-l/border-r du
             paper (qui ressortaient en clair sur le fond noir du footer).
             Devient une "ligne système" continue, pendant bas de la PulseBar.
             Conservé en Focus Mode pour la continuité du flowLabel. */}
          <div className="shell-card mx-4 mb-4" style={{ overflow: "hidden" }}>
            <StageFooter />
          </div>

          {/* Bottom nav mobile — < md uniquement, fixed bottom */}
          <MobileBottomNav />

          {/* Overlay global — toujours monté, contrôlé par useStageStore.commandeurOpen */}
          <Commandeur />

          {/* Pipeline WebRTC voix — vit au root, n'est rendu que si voiceActive */}
          <VoiceMount />

          {/* Mini-badge flottant Mode Focus (S4-B) — visible uniquement quand
             le mode est actif. Clic ou ESC pour sortir. */}
          <FocusBadge />

          {/* VideoQuickLaunch — panel latéral ⌘G (S2-A). Toujours monté pour
             la transition slide ; visibility:hidden quand fermé. */}
          <VideoQuickLaunch />
        </div>
      </ToastProvider>
    </SessionProvider>
  );
}
