"use client";

import type { CockpitTodayPayload } from "@/lib/cockpit/today";
import { useServicesStore } from "@/stores/services";
import { OrbitalNode } from "./OrbitalNode";

function GmailIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 6 12 13 2 6" />
      <path d="M2 6v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6" />
    </svg>
  );
}
function NotionIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 3h18v18H3z" />
      <path d="M7 7h3v10H7zM14 7h3v10h-3z" />
    </svg>
  );
}
function DriveIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3 2 19h20L12 3Z" />
      <path d="M9 15h6" />
    </svg>
  );
}
function AgentResearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}
function AgentWriterIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

interface NodeDef {
  id: string;
  icon: React.ReactNode;
  label: string;
  getSubInfo: (data: CockpitTodayPayload) => string | null;
  getConnected: (data: CockpitTodayPayload, connectedIds: Set<string>) => boolean;
}

const NODE_DEFS: NodeDef[] = [
  {
    id: "gmail",
    icon: <GmailIcon />,
    label: "Gmail",
    getSubInfo: (data) => {
      const count = data.inbox.brief?.items.length ?? 0;
      return count > 0 ? `${count} nouveau${count > 1 ? "x" : ""}` : null;
    },
    getConnected: (_, ids) => ids.has("gmail"),
  },
  {
    id: "notion",
    icon: <NotionIcon />,
    label: "Notion",
    getSubInfo: () => null,
    getConnected: (_, ids) => ids.has("notion"),
  },
  {
    id: "drive",
    icon: <DriveIcon />,
    label: "Drive",
    getSubInfo: () => null,
    getConnected: (_, ids) => ids.has("drive"),
  },
  {
    id: "agent-research",
    icon: <AgentResearchIcon />,
    label: "Agent Research",
    getSubInfo: (data) => {
      const running = data.missionsRunning.filter((m) => m.status === "running").length;
      return running > 0 ? "En cours" : null;
    },
    getConnected: () => true,
  },
  {
    id: "agent-writer",
    icon: <AgentWriterIcon />,
    label: "Agent Writer",
    getSubInfo: (data) => {
      const ready = data.missionsRunning.filter((m) => m.status === "success").length;
      return ready > 0 ? `${ready} prêt${ready > 1 ? "s" : ""}` : "Disponible";
    },
    getConnected: () => true,
  },
  {
    id: "calendar",
    icon: <CalendarIcon />,
    label: "Calendar",
    getSubInfo: (data) => {
      const next = data.agenda[0];
      if (next) {
        return next.title.length > 14 ? `${next.title.slice(0, 13)}…` : next.title;
      }
      return `${data.agenda.length} événement${data.agenda.length !== 1 ? "s" : ""}`;
    },
    getConnected: (data) => data.calendarConnected,
  },
];

const ROW_MAP: Record<string, number[]> = {
  top: [0],
  "mid-left": [1],
  "mid-right": [3],
  bottom: [2, 4, 5],
};

interface OrbitalNodesProps {
  data: CockpitTodayPayload;
  row: "top" | "mid-left" | "mid-right" | "bottom";
}

export function OrbitalNodes({ data, row }: OrbitalNodesProps) {
  const services = useServicesStore((s) => s.services);
  const connectedIds = new Set(
    services.filter((s) => s.connectionStatus === "connected").map((s) => s.id),
  );

  const indices = ROW_MAP[row] ?? [];

  return (
    <>
      {indices.map((i) => {
        const def = NODE_DEFS[i];
        if (!def) return null;
        return (
          <OrbitalNode
            key={def.id}
            node={{
              id: def.id,
              icon: def.icon,
              label: def.label,
              subInfo: def.getSubInfo(data),
              connected: def.getConnected(data, connectedIds),
            }}
          />
        );
      })}
    </>
  );
}
