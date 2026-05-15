import { motion } from "framer-motion";
import { useState } from "react";

const RAIL_ITEMS = [
  {
    id: "dashboard",
    hotkey: "⌘1",
    icon: <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  },
  {
    id: "missions",
    hotkey: "⌘9",
    icon: (
      <>
        <path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h7" />
        <path d="M16 19h6" />
        <path d="M19 16v6" />
      </>
    ),
  },
  {
    id: "settings",
    hotkey: "",
    icon: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </>
    ),
  },
];

const MISSIONS = [
  { id: "MSN-041", label: "Analyse pipeline LLM — cluster Production", status: "RUNNING" },
  { id: "MSN-038", label: "Rotation des clés API Composio", status: "COMPLETE" },
  { id: "MSN-036", label: "Audit RLS Supabase — tables publiques", status: "IDLE" },
];

const SETTINGS = [
  { label: "Auto_Diagnostics", value: "Activé" },
  { label: "Rate_Limit_Guard", value: "1 000 req/min" },
  { label: "Langfuse_Tracing", value: "Live" },
  { label: "Circuit_Breaker", value: "Seuil 5 erreurs" },
];

const STATUS_COLOR: Record<string, string> = {
  RUNNING: "#4A8B86",
  COMPLETE: "rgba(255,255,255,0.35)",
  IDLE: "rgba(255,255,255,0.18)",
};

export function CockpitScene() {
  const [activeRail, setActiveRail] = useState("dashboard");

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-black text-[rgba(255,255,255,0.95)] font-sans">
      {/* ── The Void (Background) ── */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(rgba(74, 139, 134, 0.01) 1px, transparent 1px), linear-gradient(90deg, rgba(74, 139, 134, 0.01) 1px, transparent 1px)",
            backgroundSize: "100px 100px",
            maskImage: "radial-gradient(circle at 50% 50%, black, transparent 80%)",
            WebkitMaskImage: "radial-gradient(circle at 50% 50%, black, transparent 80%)",
          }}
        />
      </div>

      {/* ── Sidebar (The Rail) ── */}
      <aside className="w-[72px] flex flex-col items-center py-10 gap-12 z-10 border-r border-[rgba(255,255,255,0.03)] bg-black">
        {RAIL_ITEMS.map((item) => {
          const isActive = activeRail === item.id;
          const tooltip = item.hotkey ? `${item.id} ${item.hotkey}` : item.id;
          return (
            <div
              key={item.id}
              title={tooltip}
              onClick={() => setActiveRail(item.id)}
              className={`w-10 h-10 flex items-center justify-center cursor-pointer transition-all duration-500 relative group ${isActive ? "text-[#4A8B86]" : "text-[rgba(255,255,255,0.25)] hover:text-[rgba(255,255,255,0.95)] hover:scale-110"}`}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                {item.icon}
              </svg>
              {isActive && (
                <motion.div
                  className="absolute inset-[-4px] border border-[#4A8B86] rounded-full opacity-20"
                  animate={{ scale: [1, 1.5], opacity: [0.2, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                />
              )}
            </div>
          );
        })}

        <div className="mt-auto">
          <div className="w-10 h-10 flex items-center justify-center text-[#ff3333] opacity-40 cursor-pointer transition-all hover:scale-110 hover:opacity-100">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </div>
        </div>
      </aside>

      {/* ── Main Canvas ── */}
      <main className="flex-1 flex flex-col relative z-10 overflow-y-auto overflow-x-hidden">
        {/* Header Bar */}
        <header className="px-20 py-10 flex justify-between items-end shrink-0">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <span className="font-mono text-[10px] tracking-[0.8em] text-[#4A8B86] uppercase mb-6 block">
              Protocol_Active
            </span>
            <h1 className="text-[140px] font-black tracking-[-0.08em] leading-[0.7] text-[rgba(255,255,255,0.25)] uppercase m-0 pointer-events-none select-none">
              HEARST
            </h1>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
            className="text-right"
          >
            <span className="font-mono text-[10px] text-[rgba(255,255,255,0.65)] uppercase tracking-[0.2em] block">
              System_Load
            </span>
            <div className="text-lg font-light tracking-tight mt-2 text-white">0.042ms</div>
          </motion.div>
        </header>

        {/* The Grid System */}
        <div className="flex-1 grid grid-cols-[1fr_350px] gap-px bg-[rgba(255,255,255,0.03)] border-t border-[rgba(255,255,255,0.03)] min-h-0">
          {/* Main Zone — switches on activeRail */}
          <div className="bg-black p-20 flex flex-col gap-20 overflow-y-auto">
            {activeRail === "dashboard" && (
              <>
                {/* Section: Intelligence Stream */}
                <section>
                  <span className="font-mono text-[11px] text-[rgba(255,255,255,0.65)] uppercase tracking-widest block mb-6 border-b border-[rgba(255,255,255,0.08)] pb-2">
                    01 // Intelligence_Stream
                  </span>
                  <div className="flex flex-col gap-12 pt-4">
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="grid grid-cols-[40px_1fr] gap-6"
                    >
                      <div className="font-mono text-[9px] text-[#4A8B86] opacity-80 pt-2">
                        ADR_01
                      </div>
                      <div className="text-xl font-light leading-normal text-white">
                        Analyser les performances du pipeline LLM sur le cluster Production.
                      </div>
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      className="grid grid-cols-[40px_1fr] gap-6"
                    >
                      <div className="font-mono text-[9px] text-[rgba(255,255,255,0.25)] pt-2">
                        AI_CORE
                      </div>
                      <div className="text-xl font-light leading-normal text-[rgba(255,255,255,0.95)] opacity-80">
                        Analyse lancée. 47 événements indexés. Latence p95 : 1.2ms. Aucune anomalie
                        détectée.
                      </div>
                    </motion.div>
                  </div>
                </section>

                {/* Section: Tactical Actions */}
                <section>
                  <span className="font-mono text-[11px] text-[rgba(255,255,255,0.65)] uppercase tracking-widest block mb-6 border-b border-[rgba(255,255,255,0.08)] pb-2">
                    02 // Tactical_Actions
                  </span>
                  <div className="flex gap-16 pt-4">
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.6 }}
                      className="flex flex-col gap-2"
                    >
                      <span className="font-mono text-[10px] text-[rgba(255,255,255,0.65)] uppercase tracking-[0.2em]">
                        Success_Rate
                      </span>
                      <span className="text-4xl font-extralight tracking-tight">99.8%</span>
                      <span className="font-mono text-[10px] text-[#4A8B86]">
                        +0.2% vs last_run
                      </span>
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.7 }}
                      className="flex flex-col gap-2"
                    >
                      <span className="font-mono text-[10px] text-[rgba(255,255,255,0.65)] uppercase tracking-[0.2em]">
                        Active_Missions
                      </span>
                      <span className="text-4xl font-extralight tracking-tight">12</span>
                      <span className="font-mono text-[10px] text-[#4A8B86]">All_Nominal</span>
                    </motion.div>
                  </div>
                </section>
              </>
            )}

            {activeRail === "missions" && (
              <section>
                <span className="font-mono text-[11px] text-[rgba(255,255,255,0.65)] uppercase tracking-widest block mb-6 border-b border-[rgba(255,255,255,0.08)] pb-2">
                  03 // Mission_Queue
                </span>
                <div className="flex flex-col gap-[2px] pt-4">
                  {MISSIONS.map((m, i) => (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 * i }}
                      className="grid grid-cols-[90px_1fr_90px] gap-6 items-center py-5 border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)] transition-colors cursor-pointer"
                    >
                      <span className="font-mono text-[10px] text-[rgba(255,255,255,0.35)]">
                        {m.id}
                      </span>
                      <span className="text-sm font-light text-[rgba(255,255,255,0.85)]">
                        {m.label}
                      </span>
                      <span
                        className="font-mono text-[9px] tracking-[0.15em] text-right"
                        style={{ color: STATUS_COLOR[m.status] }}
                      >
                        {m.status}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </section>
            )}

            {activeRail === "settings" && (
              <section>
                <span className="font-mono text-[11px] text-[rgba(255,255,255,0.65)] uppercase tracking-widest block mb-6 border-b border-[rgba(255,255,255,0.08)] pb-2">
                  04 // System_Config
                </span>
                <div className="flex flex-col gap-[2px] pt-4">
                  {SETTINGS.map((s, i) => (
                    <motion.div
                      key={s.label}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.12 * i }}
                      className="flex items-center justify-between py-5 border-b border-[rgba(255,255,255,0.04)]"
                    >
                      <span className="font-mono text-[10px] text-[rgba(255,255,255,0.55)] uppercase tracking-[0.15em]">
                        {s.label}
                      </span>
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-light text-[rgba(255,255,255,0.75)]">
                          {s.value}
                        </span>
                        <button className="font-mono text-[9px] text-[#4A8B86] border border-[rgba(74,139,134,0.3)] px-3 py-1 hover:border-[#4A8B86] transition-colors">
                          Edit
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Side Zone */}
          <div className="bg-black p-10 flex flex-col border-l border-[rgba(255,255,255,0.03)]">
            <span className="font-mono text-[11px] text-[rgba(255,255,255,0.65)] uppercase tracking-widest block mb-6 border-b border-[rgba(255,255,255,0.08)] pb-2">
              System_HUD
            </span>

            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="flex items-center gap-3 mb-6"
            >
              <div className="flex-1">
                <div className="font-mono text-[10px] text-[rgba(255,255,255,0.65)] uppercase tracking-[0.2em] mb-2">
                  Neural_Engine
                </div>
                <div className="h-[2px] w-full bg-[rgba(255,255,255,0.08)] relative">
                  <motion.div
                    className="absolute inset-y-0 left-0 bg-[#4A8B86] shadow-[0_0_10px_#4A8B86]"
                    initial={{ width: 0 }}
                    animate={{ width: "75%" }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                  />
                </div>
              </div>
              <span className="font-mono text-[10px] text-[rgba(255,255,255,0.95)] mt-4">75%</span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="flex items-center gap-3 mb-16"
            >
              <div className="flex-1">
                <div className="font-mono text-[10px] text-[rgba(255,255,255,0.65)] uppercase tracking-[0.2em] mb-2">
                  Memory_Buffer
                </div>
                <div className="h-[2px] w-full bg-[rgba(255,255,255,0.08)] relative">
                  <motion.div
                    className="absolute inset-y-0 left-0 bg-[#4A8B86] shadow-[0_0_10px_#4A8B86]"
                    initial={{ width: 0 }}
                    animate={{ width: "32%" }}
                    transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
                  />
                </div>
              </div>
              <span className="font-mono text-[10px] text-[rgba(255,255,255,0.95)] mt-4">32%</span>
            </motion.div>

            <span className="font-mono text-[11px] text-[rgba(255,255,255,0.65)] uppercase tracking-widest block mb-4 border-b border-[rgba(255,255,255,0.08)] pb-2">
              Quick_Access
            </span>

            <div className="flex flex-col gap-[2px]">
              {[
                { label: "View_Logs", meta: "⌘L" },
                { label: "Network_Map", meta: "⌘N" },
                { label: "Security_Vault", meta: "⌘S" },
                { label: "Terminal_Shell", meta: "⌘T" },
              ].map((item, i) => (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + i * 0.1 }}
                  key={item.label}
                  className="flex justify-between items-center py-4 border-b border-[rgba(255,255,255,0.03)] cursor-pointer transition-all duration-300 hover:pl-3 hover:border-b-[#4A8B86] group"
                >
                  <span className="text-sm font-medium text-[rgba(255,255,255,0.65)] group-hover:text-white transition-colors">
                    {item.label}
                  </span>
                  <span className="font-mono text-[10px] text-[rgba(255,255,255,0.25)] transition-colors">
                    {item.meta}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Command Bar ── */}
        <div className="sticky bottom-0 bg-linear-to-t from-black via-black/90 to-transparent pt-16 pb-10 px-20 z-20 shrink-0">
          <div className="flex items-center gap-6 border-b border-[rgba(255,255,255,0.08)] pb-4">
            <span className="font-mono text-xs text-[#4A8B86]">HEARST_OS &gt;</span>
            <input
              type="text"
              className="bg-transparent border-none flex-1 text-[rgba(255,255,255,0.95)] text-2xl font-sans outline-none placeholder:text-[rgba(255,255,255,0.25)]"
              placeholder="Enter_Command_"
            />
          </div>
        </div>
      </main>
    </div>
  );
}
