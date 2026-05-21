"use client";

import { type CockpitProduct, CockpitShell, setActiveProduct } from "@hearst/cockpit-shell";
import { SessionProvider } from "next-auth/react";
import { useEffect } from "react";
import { Commandeur } from "@/app/(user)/components/Commandeur";
import { FocusBadge } from "@/app/(user)/components/FocusBadge";
import { MobileBottomNav } from "@/app/(user)/components/MobileBottomNav";
import { VoicePulse } from "@/app/(user)/components/voice/VoicePulse";
import { useGlobalHotkeys } from "@/app/hooks/use-global-hotkeys";
import { useFocusMode } from "@/stores/focus-mode";
import { useVoiceStore } from "@/stores/voice";

/**
 * Produits déclarés au CockpitShell (PR7).
 *
 * Le premier produit est Helm lui-même (= produit hôte, `appId="helm"`).
 * Sa couleur reste `var(--accent-teal)` pour préserver le visionOS via
 * l'inline style `--ct-accent` posé par ThemeAccent (cf. PR1/PR4).
 *
 * Les 4 produits suivants (hub, halo, hyper, hustle) viennent de la
 * liste canonical de la suite Hearst Corp (hub PR `config/products.ts`,
 * consolidation 2026-05-20 : 13 produits historiques → 4 commerciaux
 * + 1 shell). Cortex (vault Obsidian + Qdrant) est un service backend
 * transverse et n'apparait pas dans le launcher.
 *
 * Les URLs `prodUrl` permettent au <ProductLauncherBar> de naviguer
 * cross-domaine au clic. Couleurs alignées Brand Kit Hearst Corp.
 *
 * Note : "hive" du canonical Hub désigne en fait Helm (hearst-os
 * localhost:4102 / hearst-os.vercel.app). Helm peut donc se déclarer
 * soit comme "helm" (locale, conserve les overrides CSS PR1+) soit
 * "hive" (alignement Hub canonical, breaking côté mapping CSS). On
 * choisit "helm" pour stabilité — à arbitrer plus tard si convergence
 * naming nécessaire.
 */
const HELM_PRODUCTS: CockpitProduct[] = [
  { id: "helm", name: "Helm", short: "HE", color: "var(--accent-teal)" },
  {
    id: "hub",
    name: "Hearst Corporation",
    short: "HC",
    color: "var(--ct-product-hub)",
    url: "https://hearst-corporation.vercel.app",
  },
  {
    id: "halo",
    name: "Hearst Halo",
    short: "HL",
    color: "var(--ct-product-halo)",
    url: "https://studio-hearst-corporation.vercel.app",
  },
  {
    id: "hyper",
    name: "Hearst Hyper",
    short: "HY",
    color: "var(--ct-product-hyper)",
    url: "https://frontend-hearst-corporation.vercel.app",
  },
  {
    id: "hustle",
    name: "Hearst Hustle",
    short: "HU",
    color: "var(--ct-product-hustle)",
    url: "https://dropship-platform-amber.vercel.app",
  },
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
   * Workaround visibility activeProductStore (PR5b, conservé en PR7).
   *
   * <CockpitShell> appelle `setDefaultActive(appId)` côté client mais cette
   * fonction pose la valeur sans appeler `notifyListeners()`. Les composants
   * du package (ex: <ProductLauncherBar>) consomment
   * `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)` sur
   * l'activeProductStore qui reste à "hub" (DEFAULT_ID initial) → la
   * pastille "active" reste sur hub au lieu de Helm.
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
          <VoiceMount />
          <FocusBadge />
          <MobileBottomNav />
          <FocusModeStyles />
        </div>
      </CockpitShell>
    </SessionProvider>
  );
}
