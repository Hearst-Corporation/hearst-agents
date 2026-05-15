import { Link, Route, Routes, useLocation } from "react-router-dom";
import { CommandBar } from "./components/CommandBar";
import { SCENES } from "./scenes/registry";
import { AssetStage } from "./stages/AssetStage";
import { BrowserStage } from "./stages/BrowserStage";
import { ChartsStage } from "./stages/ChartsStage";
import { ChatStage } from "./stages/ChatStage";
import { CockpitLegacyStage } from "./stages/CockpitLegacyStage";
import { KGStage } from "./stages/KGStage";
import { MissionStage } from "./stages/MissionStage";
import { PlaceholderStage } from "./stages/PlaceholderStage";
import { VoiceStage } from "./stages/VoiceStage";
import { type StageId, useStageStore } from "./stores/stage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Shell />} />
      {SCENES.map((s) => (
        <Route key={s.path} path={s.path} element={<s.Component />} />
      ))}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

// ── Tokens ──────────────────────────────────────────────────────────────────
const TEAL = "#4A8B86";
const TEXT_BRIGHT = "rgba(255,255,255,0.95)";
const TEXT_MUTED = "rgba(255,255,255,0.65)";
const TEXT_GHOST = "rgba(255,255,255,0.25)";
const BORDER_FAINT = "rgba(255,255,255,0.03)";

// ── Rail items ───────────────────────────────────────────────────────────────
interface RailItem {
  id: StageId;
  label: string;
  hotkey?: string;
  icon: React.ReactNode;
}

const RAIL_ITEMS: RailItem[] = [
  {
    id: "home",
    label: "Cockpit",
    hotkey: "⌘1",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      </svg>
    ),
  },
  {
    id: "chat",
    label: "Chat",
    hotkey: "⌘2",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    id: "mission",
    label: "Mission",
    hotkey: "⌘9",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8l4 4-4 4" />
        <path d="M8 12h8" />
      </svg>
    ),
  },
  {
    id: "asset",
    label: "Asset",
    hotkey: "⌘3",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    ),
  },
  {
    id: "browser",
    label: "Browser",
    hotkey: "⌘4",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
  },
  {
    id: "voice",
    label: "Voix",
    hotkey: "⌘7",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
      </svg>
    ),
  },
  {
    id: "kg",
    label: "Graph",
    hotkey: "⌘6",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
      </svg>
    ),
  },
  {
    id: "charts",
    label: "Charts",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    id: "cockpit-legacy",
    label: "Cockpit V1",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
];

// ── Stage map ────────────────────────────────────────────────────────────────
function StageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden">
      <div className="max-w-[760px] mx-auto px-10 py-10">{children}</div>
    </div>
  );
}

const STAGE_MAP: Record<StageId, React.ReactNode> = {
  home: <PlaceholderStage label="Cockpit" />,
  chat: (
    <StageWrapper>
      <ChatStage />
    </StageWrapper>
  ),
  mission: (
    <StageWrapper>
      <MissionStage />
    </StageWrapper>
  ),
  asset: (
    <StageWrapper>
      <AssetStage />
    </StageWrapper>
  ),
  browser: (
    <StageWrapper>
      <BrowserStage />
    </StageWrapper>
  ),
  voice: (
    <StageWrapper>
      <VoiceStage />
    </StageWrapper>
  ),
  meeting: <PlaceholderStage label="Réunion" />,
  artifact: <PlaceholderStage label="Artifact" />,
  kg: (
    <StageWrapper>
      <KGStage />
    </StageWrapper>
  ),
  briefing: <PlaceholderStage label="Briefing" />,
  rapport: <PlaceholderStage label="Rapport" />,
  signal: <PlaceholderStage label="Signal" />,
  apps: <PlaceholderStage label="Applications" />,
  charts: <ChartsStage />,
  "cockpit-legacy": <CockpitLegacyStage />,
};

// ── Left Rail ────────────────────────────────────────────────────────────────
function LeftRail() {
  const { current, setStage } = useStageStore();

  return (
    <aside
      className="w-[200px] shrink-0 flex flex-col py-8 overflow-y-auto"
      style={{ borderRight: `1px solid ${BORDER_FAINT}`, background: "rgba(0,0,0,0.6)" }}
    >
      {/* Wordmark */}
      <div className="px-5 mb-8">
        <p className="font-mono text-[9px] uppercase tracking-[0.25em]" style={{ color: TEAL }}>
          HEARST_OS
        </p>
        <p className="font-mono text-[8px] mt-0.5" style={{ color: TEXT_GHOST }}>
          LAB // CLI-OS
        </p>
      </div>

      {/* Nav items */}
      <nav className="flex flex-col gap-px px-2">
        {RAIL_ITEMS.map((item) => {
          const isActive = current === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setStage(item.id)}
              className="flex items-center gap-3 px-3 py-2.5 rounded text-left w-full transition-all duration-150"
              style={{
                background: isActive ? "rgba(74,139,134,0.1)" : "transparent",
                color: isActive ? TEXT_BRIGHT : TEXT_MUTED,
                border: `1px solid ${isActive ? "rgba(74,139,134,0.25)" : "transparent"}`,
              }}
            >
              <span style={{ color: isActive ? TEAL : TEXT_GHOST, flexShrink: 0 }}>
                {item.icon}
              </span>
              <span className="text-[13px] font-medium flex-1 truncate">{item.label}</span>
              {item.hotkey && (
                <span className="font-mono text-[9px] shrink-0" style={{ color: TEXT_GHOST }}>
                  {item.hotkey}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Spacer + scenes link */}
      <div className="mt-auto px-5 pt-8">
        <div className="pb-3" style={{ borderTop: `1px solid ${BORDER_FAINT}` }} />
        <Link
          to="/cockpit"
          className="font-mono text-[9px] uppercase tracking-[0.2em] transition-colors hover:text-white block"
          style={{ color: TEXT_GHOST }}
        >
          → Scènes lab
        </Link>
      </div>
    </aside>
  );
}

// ── Shell ────────────────────────────────────────────────────────────────────
function Shell() {
  const current = useStageStore((s) => s.current);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-black">
      <LeftRail />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Stage header */}
        <div
          className="shrink-0 flex items-center justify-between px-10 py-4"
          style={{ borderBottom: `1px solid ${BORDER_FAINT}` }}
        >
          <p
            className="font-mono text-[9px] uppercase tracking-[0.25em]"
            style={{ color: TEXT_GHOST }}
          >
            STAGE // {current.toUpperCase()}
          </p>
          <p
            className="font-mono text-[9px] uppercase tracking-[0.2em]"
            style={{ color: TEXT_GHOST }}
          >
            ⌘K — focus command bar
          </p>
        </div>

        {/* Stage content */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {STAGE_MAP[current]}
          <CommandBar />
        </div>
      </main>
    </div>
  );
}

// ── 404 ──────────────────────────────────────────────────────────────────────
function NotFound() {
  const { pathname } = useLocation();
  return (
    <div
      className="min-h-screen bg-black flex flex-col items-center justify-center px-12"
      style={{ color: TEXT_MUTED }}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] mb-4" style={{ color: TEAL }}>
        404 // NOT_FOUND
      </p>
      <p
        className="text-[64px] font-black uppercase leading-none mb-8 select-none"
        style={{ letterSpacing: "-0.06em", color: TEXT_GHOST }}
      >
        {pathname}
      </p>
      <Link
        to="/"
        className="font-mono text-[10px] uppercase tracking-[0.2em] transition-colors hover:text-white"
        style={{ color: TEXT_GHOST }}
      >
        ← RETOUR_INDEX
      </Link>
    </div>
  );
}
