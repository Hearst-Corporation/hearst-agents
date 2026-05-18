"use client";

import { useHubMode } from "@hearst/hub-sdk";
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

// Contrat hub-mode v1 : embarqué dans le hub Hearst (window.hearstHub / ?hub=1
// / session), Helm n'affiche QUE son contenu — son rail gauche (nav) et son
// rail droit (advisor) sont masqués pour ne pas doubler le chrome du hub.
// Même mécanique exacte que FocusModeStyles (CSS injecté, zéro modif
// structurelle). Standalone : isHub === false → rien d'injecté → no-op strict.
// NB : le menu est masqué, pas encore re-publié dans le rail du hub (contrat
// de menu v2, hors de ce palier).
//
// WHY — compositing <webview> Electron (BrowserPlugin) :
// Dans un guest <webview>, le moteur de compositing Chromium ne peut pas
// résoudre filter:blur(), backdrop-filter:blur(), mask-image/-webkit-mask-image
// et transform-style:preserve-3d de la même façon qu'une tab normale → tout
// le contenu central rend noir/vide (le DOM texte de la barre haute se peint
// car il n'est pas derrière ces couches). On neutralise UNIQUEMENT en isHub :
//   • AmbientLayers : display:none des deux <div data-ambient> (filter:blur +
//     mask-image → supprimés physiquement, pas juste cachés par opacity).
//   • .vision-glass / .vision-btn-glass / .orbital-chip / .halo-core-badge
//     / .ghost-overlay-backdrop / .kg-chip : backdrop-filter → none, fond
//     opaque via var(--bg) (#000000 par défaut, #050607 thème robotflow)
//     pour éviter zones claires. (--surface = rgba(255,255,255,0.02), quasi
//     transparent — ne pas utiliser comme fond opaque.)
//   • .preserve-3d : transform-style → flat (preserve-3d crée un stacking
//     context qui casse aussi le compositing guest).
// Standalone (isHub === false) : rien de tout ça n'est injecté → no-op strict.
function HubModeStyles() {
  const { isHub } = useHubMode();
  if (!isHub) return null;
  return (
    <style>{`
      /* ── Rails & layout ───────────────────────────────── */
      .vision-rail-left  { display: none !important; }
      .vision-rail-right { display: none !important; }
      .vision-content-depth { max-width: 100vw !important; padding-left: 2rem !important; padding-right: 2rem !important; }

      /* ── AmbientLayers : filter:blur + mask-image → hors compositing webview */
      [data-ambient] { display: none !important; }

      /* ── backdrop-filter → none sur toutes les classes concernées ── */
      .vision-glass,
      .vision-glass::before {
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        background: var(--bg) !important;
      }
      .vision-btn-glass {
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        background: var(--border-input) !important;
      }
      .orbital-chip {
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        background: var(--line-strong) !important;
      }
      .halo-core-badge[data-mode="dark"] {
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
      }
      .ghost-overlay-backdrop {
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        background: color-mix(in srgb, var(--mat-400) 85%, transparent) !important;
      }
      .kg-chip {
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
      }

      /* ── preserve-3d → flat (stacking context cassé en guest webview) ── */
      .preserve-3d { transform-style: flat !important; }
      .perspective-scene { perspective: none !important; }
    `}</style>
  );
}

export default function UserXLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  useGlobalHotkeys();
  return (
    <SessionProvider>
      <div
        className="h-screen w-full overflow-hidden antialiased"
        style={{
          background: "var(--bg, var(--ct-bg-deep))",
          color: "var(--text, var(--ct-text-primary))",
        }}
      >
        {children}
        <Commandeur />
        <VideoQuickLaunch />
        <VoiceMount />
        <FocusBadge />
        <MobileBottomNav />
        <FocusModeStyles />
        <HubModeStyles />
      </div>
    </SessionProvider>
  );
}
