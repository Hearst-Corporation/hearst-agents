"use client";

import { SessionProvider } from "next-auth/react";
import { Commandeur } from "@/app/(user)/components/Commandeur";
import { FocusBadge } from "@/app/(user)/components/FocusBadge";
import { MobileBottomNav } from "@/app/(user)/components/MobileBottomNav";
import { VideoQuickLaunch } from "@/app/(user)/components/VideoQuickLaunch";
import { VoicePulse } from "@/app/(user)/components/voice/VoicePulse";
import { useGlobalHotkeys } from "@/app/hooks/use-global-hotkeys";
import { useFocusMode } from "@/stores/focus-mode";
import { useVoiceStore } from "@/stores/voice";

function VoiceMount() {
  const voiceActive = useVoiceStore((s) => s.voiceActive);
  if (!voiceActive) return null;
  return <VoicePulse />;
}

function FocusModeStyles() {
  const enabled = useFocusMode((s) => s.enabled);
  if (!enabled) return null;
  return (
    <style>{`
      .vision-rail-right { display: none !important; }
      .vision-content-depth { max-width: 100vw !important; padding-right: 2rem !important; }
    `}</style>
  );
}

export default function UserXLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  useGlobalHotkeys();
  return (
    <SessionProvider>
      <div className="h-screen w-full overflow-hidden bg-black text-white antialiased">
        {children}
        <Commandeur />
        <VideoQuickLaunch />
        <VoiceMount />
        <FocusBadge />
        <MobileBottomNav />
        <FocusModeStyles />
      </div>
    </SessionProvider>
  );
}
