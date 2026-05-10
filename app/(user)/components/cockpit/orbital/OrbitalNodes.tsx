"use client";

import { useServicesStore } from "@/stores/services";
import type { CockpitTodayPayload } from "@/lib/cockpit/today";
import { OrbitalNode, type ServiceNode } from "./OrbitalNode";

// Offsets relatifs au centre de l'orbe (px)
// 3 à gauche (top→bottom) + 3 à droite (top→bottom)
export const NODE_OFFSETS = [
  { x: -248, y: -130 },  // Gmail         — haut gauche
  { x: -268, y:    8 },  // Notion        — milieu gauche
  { x: -248, y:  148 },  // Drive         — bas gauche
  { x:  248, y: -130 },  // Agent Research — haut droite
  { x:  268, y:    8 },  // Agent Writer   — milieu droite
  { x:  248, y:  148 },  // Calendar      — bas droite
];

// Icônes SVG inline
function GmailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m2 7 10 6 10-6" />
    </svg>
  );
}
function NotionIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M8 8h5M8 12h8M8 16h5" />
    </svg>
  );
}
function DriveIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 2 19h20L12 3Z" />
      <path d="m7 15 5-8 5 8" />
    </svg>
  );
}
function AgentResearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
      <path d="M11 8v6M8 11h6" />
    </svg>
  );
}
function AgentWriterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function buildNodes(data: CockpitTodayPayload, connectedIds: Set<string>): ServiceNode[] {
  const inboxCount = data.inbox.brief?.items.length ?? 0;
  const nextEvent = data.agenda[0];
  const running = data.missionsRunning.filter((m) => m.status === "running").length;
  const ready = data.missionsRunning.filter((m) => m.status === "success").length;

  return [
    {
      id: "gmail",
      icon: <GmailIcon />,
      label: "Gmail",
      subInfo: inboxCount > 0 ? `${inboxCount} nouveau${inboxCount > 1 ? "x" : ""}` : null,
      connected: connectedIds.has("gmail"),
    },
    {
      id: "notion",
      icon: <NotionIcon />,
      label: "Notion",
      subInfo: null,
      connected: connectedIds.has("notion"),
    },
    {
      id: "drive",
      icon: <DriveIcon />,
      label: "Drive",
      subInfo: null,
      connected: connectedIds.has("drive"),
    },
    {
      id: "agent-research",
      icon: <AgentResearchIcon />,
      label: "Agent Research",
      subInfo: running > 0 ? "En cours" : "En veille",
      connected: true,
    },
    {
      id: "agent-writer",
      icon: <AgentWriterIcon />,
      label: "Agent Writer",
      subInfo: ready > 0 ? `${ready} prêt${ready > 1 ? "s" : ""}` : "Disponible",
      connected: true,
    },
    {
      id: "calendar",
      icon: <CalendarIcon />,
      label: "Calendar",
      subInfo: nextEvent
        ? `${nextEvent.title.length > 14 ? nextEvent.title.slice(0, 13) + "…" : nextEvent.title}`
        : `${data.agenda.length} événement${data.agenda.length !== 1 ? "s" : ""}`,
      connected: data.calendarConnected,
    },
  ];
}

interface OrbitalNodesProps {
  data: CockpitTodayPayload;
  centerX: number;
  centerY: number;
}

export function OrbitalNodes({ data, centerX, centerY }: OrbitalNodesProps) {
  const services = useServicesStore((s) => s.services);
  const connectedIds = new Set(
    services.filter((s) => s.connectionStatus === "connected").map((s) => s.id)
  );

  const nodes = buildNodes(data, connectedIds);

  return (
    <>
      {nodes.map((node, i) => {
        const offset = NODE_OFFSETS[i];
        return (
          <OrbitalNode
            key={node.id}
            node={node}
            style={{
              position: "absolute",
              left: centerX + offset.x,
              top: centerY + offset.y,
              transform: "translate(-50%, -50%)",
            }}
          />
        );
      })}
    </>
  );
}
