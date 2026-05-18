"use client";

import { useStageStore } from "@/stores/stage";

type NavItem = {
  id: "cockpit" | "chat" | "mission" | "commandeur" | "today";
  label: string;
};

const ITEMS: NavItem[] = [
  { id: "cockpit", label: "Dashboard" },
  { id: "chat", label: "Chat" },
  { id: "mission", label: "Missions" },
  { id: "commandeur", label: "Commandeur" },
  { id: "today", label: "Aujourd'hui" },
];

export function HelmBottomBar() {
  const setMode = useStageStore((s) => s.setMode);
  const currentMode = useStageStore((s) => s.current.mode);
  const lastMissionId = useStageStore((s) => s.lastMissionId);
  const setCommandeurOpen = useStageStore((s) => s.setCommandeurOpen);

  const handlePress = (id: NavItem["id"]) => {
    switch (id) {
      case "cockpit":
        setMode({ mode: "cockpit" });
        break;
      case "chat":
        setMode({ mode: "chat" });
        break;
      case "mission":
        setMode({ mode: "mission", missionId: lastMissionId ?? "" });
        break;
      case "commandeur":
        setCommandeurOpen(true);
        break;
      case "today":
        setCommandeurOpen(true, { prefilledQuery: "brief du jour" });
        break;
    }
  };

  const isActive = (id: NavItem["id"]) =>
    id === "cockpit"
      ? currentMode === "cockpit"
      : id === "chat"
        ? currentMode === "chat"
        : id === "mission"
          ? currentMode === "mission"
          : false;

  return (
    <>
      <span className="ct-bottom-label">● Hearst OS</span>
      <nav aria-label="Navigation Helm" className="ct-seg-track">
        {ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => handlePress(item.id)}
            className={`ct-seg-btn${isActive(item.id) ? " active" : ""}`}
            aria-current={isActive(item.id) ? "page" : undefined}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </>
  );
}
