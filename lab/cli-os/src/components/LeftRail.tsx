import { type StageId, useStageStore } from "../stores/stage";

interface SlotDef {
  id: StageId;
  label: string;
  icon: React.ReactNode;
}

const MAIN_SLOTS: SlotDef[] = [
  {
    id: "home",
    label: "Accueil",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="2" y="2" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    id: "chat",
    label: "Conversation",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <line
          x1="3"
          y1="6"
          x2="15"
          y2="6"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <line
          x1="3"
          y1="9"
          x2="15"
          y2="9"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <line
          x1="3"
          y1="12"
          x2="10"
          y2="12"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: "mission",
    label: "Mission",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    id: "asset",
    label: "Asset",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="3" y="3" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <rect x="6" y="6" width="6" height="6" rx="0.5" stroke="currentColor" strokeWidth="1" />
      </svg>
    ),
  },
  {
    id: "browser",
    label: "Navigateur",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <polygon
          points="4,14 14,9 4,4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: "voice",
    label: "Voix",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="9" r="4" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "meeting",
    label: "Réunion",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <line
          x1="3"
          y1="9"
          x2="15"
          y2="9"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: "artifact",
    label: "Artifact",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="2" y="2" width="14" height="14" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <polyline
          points="6,11 8,9 6,7"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line
          x1="10"
          y1="11"
          x2="12"
          y2="11"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: "kg",
    label: "Knowledge Graph",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="9" cy="9" r="2" stroke="currentColor" strokeWidth="1" />
      </svg>
    ),
  },
  {
    id: "briefing",
    label: "Briefing",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="4" y="2" width="10" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <line
          x1="6.5"
          y1="6"
          x2="11.5"
          y2="6"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
        />
        <line
          x1="6.5"
          y1="9"
          x2="11.5"
          y2="9"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
        />
        <line
          x1="6.5"
          y1="12"
          x2="9.5"
          y2="12"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

const SECONDARY_SLOTS: SlotDef[] = [
  {
    id: "rapport",
    label: "Rapport",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <line
          x1="3"
          y1="5"
          x2="15"
          y2="5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <line
          x1="3"
          y1="9"
          x2="15"
          y2="9"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <line
          x1="3"
          y1="13"
          x2="9"
          y2="13"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: "signal",
    label: "Signal",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <polygon
          points="9,3 16,15 2,15"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    ),
  },
  {
    id: "apps",
    label: "Applications",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="2" y="2" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <rect x="10" y="2" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <rect x="2" y="10" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <rect x="10" y="10" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
];

function Slot({ def, active, onClick }: { def: SlotDef; active: boolean; onClick: () => void }) {
  return (
    <button
      title={def.label}
      onClick={onClick}
      style={{
        width: 48,
        height: 48,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 12,
        border: active ? "1px solid rgba(255,255,255,0.18)" : "1px solid transparent",
        background: active ? "rgba(255,255,255,0.05)" : "transparent",
        boxShadow: active
          ? "inset 0 1px 0 rgba(255,255,255,0.15), 0 4px 12px rgba(0,0,0,0.25)"
          : "none",
        color: active ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.5)",
        cursor: "pointer",
        transition: "all 180ms ease",
        flexShrink: 0,
        outline: "none",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.95)";
          (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.03)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.5)";
          (e.currentTarget as HTMLButtonElement).style.background = "transparent";
        }
      }}
    >
      {def.icon}
    </button>
  );
}

export function LeftRail() {
  const { current, setStage } = useStageStore();

  return (
    <aside
      style={{
        width: 88,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: 20,
        paddingBottom: 20,
        gap: 4,
        background: "rgba(255,255,255,0.03)",
        borderRight: "1px solid rgba(255,255,255,0.12)",
        backdropFilter: "blur(60px)",
        zIndex: 10,
      }}
    >
      {/* Logo */}
      <div
        style={{
          width: 48,
          height: 48,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 12,
        }}
      >
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.9)",
            boxShadow: "0 0 12px rgba(255,255,255,0.4)",
          }}
        />
      </div>

      {/* Main slots */}
      {MAIN_SLOTS.map((s) => (
        <Slot key={s.id} def={s} active={current === s.id} onClick={() => setStage(s.id)} />
      ))}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Secondary slots */}
      {SECONDARY_SLOTS.map((s) => (
        <Slot key={s.id} def={s} active={current === s.id} onClick={() => setStage(s.id)} />
      ))}

      {/* Avatar */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.18)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          fontWeight: 600,
          color: "rgba(255,255,255,0.65)",
          marginTop: 8,
          cursor: "pointer",
        }}
      >
        A
      </div>
    </aside>
  );
}
