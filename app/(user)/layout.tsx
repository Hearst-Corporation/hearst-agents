"use client";

import { SessionProvider } from "next-auth/react";
import { Commandeur } from "@/app/(user)/components/Commandeur";
import { FocusBadge } from "@/app/(user)/components/FocusBadge";
import { VideoQuickLaunch } from "@/app/(user)/components/VideoQuickLaunch";
import { VoicePulse } from "@/app/(user)/components/voice/VoicePulse";
import { useGlobalHotkeys } from "@/app/hooks/use-global-hotkeys";
import { useVoiceStore } from "@/stores/voice";

function VoiceMount() {
  const voiceActive = useVoiceStore((s) => s.voiceActive);
  if (!voiceActive) return null;
  return <VoicePulse />;
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
      </div>
    </SessionProvider>
  );
}
