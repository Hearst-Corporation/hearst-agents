import { useEffect, useRef, useState } from "react";
import { type StageId, useStageStore } from "../stores/stage";

const CMD_MAP: Record<string, StageId> = {
  cockpit: "home",
  home: "home",
  chat: "chat",
  mission: "mission",
  missions: "mission",
  asset: "asset",
  assets: "asset",
  browser: "browser",
  voice: "voice",
  meeting: "meeting",
  artifact: "artifact",
  kg: "kg",
  graph: "kg",
  briefing: "briefing",
  brief: "briefing",
  rapport: "rapport",
  signal: "signal",
  apps: "apps",
  connecteurs: "apps",
  charts: "charts",
  "cockpit-legacy": "cockpit-legacy",
  "cockpit v1": "cockpit-legacy",
};

const TEAL = "#4A8B86";
const TEXT_GHOST = "rgba(255,255,255,0.25)";
const BORDER_SOFT = "rgba(255,255,255,0.08)";

export function CommandBar() {
  const setStage = useStageStore((s) => s.setStage);
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const dispatch = () => {
    const raw = value.toLowerCase().trim();
    const target = CMD_MAP[raw];
    if (target) {
      setStage(target);
      setValue("");
    } else {
      setError(true);
      setTimeout(() => setError(false), 500);
    }
  };

  return (
    <div
      className="sticky bottom-0 shrink-0"
      style={{
        background: "linear-gradient(to bottom, transparent, #000 60px)",
        paddingTop: "60px",
        paddingBottom: "40px",
        paddingLeft: "80px",
        paddingRight: "80px",
      }}
    >
      <div
        className="flex items-center gap-6"
        style={{ borderBottom: `1px solid ${BORDER_SOFT}`, paddingBottom: "16px" }}
      >
        <span
          className="font-mono text-xs shrink-0 transition-colors duration-150"
          style={{ color: error ? "#ff3333" : TEAL }}
        >
          HEARST_OS &gt;
        </span>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") dispatch();
            if (e.key === "Escape") setValue("");
          }}
          className="bg-transparent border-none flex-1 font-sans outline-none"
          style={{
            color: "rgba(255,255,255,0.95)",
            fontSize: "24px",
          }}
          placeholder="Entrer une commande_"
          spellCheck={false}
          autoComplete="off"
        />
        {value && (
          <span
            className="font-mono text-[10px] uppercase tracking-widest shrink-0"
            style={{ color: TEXT_GHOST }}
          >
            ↵ ENTER
          </span>
        )}
      </div>
    </div>
  );
}
