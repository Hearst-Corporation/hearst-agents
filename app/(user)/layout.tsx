"use client";

import {
  type CockpitProduct,
  CockpitShell,
  HubBottomBar,
  setActiveProduct,
} from "@hearst/cockpit-shell";
import { SessionProvider } from "next-auth/react";
import { useEffect } from "react";
import { Commandeur } from "@/app/(user)/components/Commandeur";
import { FocusBadge } from "@/app/(user)/components/FocusBadge";
import { MobileBottomNav } from "@/app/(user)/components/MobileBottomNav";
import { VideoQuickLaunch } from "@/app/(user)/components/VideoQuickLaunch";
import { VoicePulse } from "@/app/(user)/components/voice/VoicePulse";
import { useGlobalHotkeys } from "@/app/hooks/use-global-hotkeys";
import { useFocusMode } from "@/stores/focus-mode";
import { useVoiceStore } from "@/stores/voice";

/**
 * Produits déclarés au CockpitShell — en mode headless le launcher du package
 * n'est pas rendu, mais ThemeAccent consomme `getProduct(active).color` pour
 * piloter `--ct-accent` via inline style sur `<html>`. On déclare donc Helm
 * avec sa signature teal visionOS pour que l'inline style résolve sur le bon
 * accent (et n'écrase pas l'override PR1 par le défaut `#be123c` bordeaux
 * Cockpit canonical).
 */
const HELM_PRODUCTS: CockpitProduct[] = [
  { id: "helm", name: "Helm", short: "HE", color: "var(--accent-teal)" },
];

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
  /*
   * Workaround visibility HubBottomBar (PR5 → PR5b).
   *
   * Le package <CockpitShell> appelle `setDefaultActive(appId)` côté client
   * dans un useEffect. Mais `setDefaultActive` pose la valeur via
   * `_default = id` sans appeler `notifyListeners()`. Le HubBottomBar
   * consomme `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)`
   * sur l'activeProductStore, qui reste à "hub" (DEFAULT_ID initial).
   * Sa condition `if (active !== appId) return null` masque alors le bar
   * en runtime client (déjà null en SSR par design).
   *
   * Fix : on force `setActiveProduct("helm")` (qui appelle notifyListeners)
   * au mount du layout user pour synchroniser le store sur l'appId Helm.
   */
  useEffect(() => {
    setActiveProduct("helm");
  }, []);
  return (
    <SessionProvider>
      <CockpitShell appId="helm" headless products={HELM_PRODUCTS}>
        <div className="h-screen w-full overflow-hidden bg-black text-white antialiased">
          {children}
          <Commandeur />
          <VideoQuickLaunch />
          <VoiceMount />
          <FocusBadge />
          <MobileBottomNav />
          <FocusModeStyles />
          <HubBottomBar />
        </div>
      </CockpitShell>
    </SessionProvider>
  );
}
