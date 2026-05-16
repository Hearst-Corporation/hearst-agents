import { motion } from "framer-motion";
import React, { useEffect, useRef, useState } from "react";

// ==========================================
// TOKENS & UTILS (From HEARST OS DS v5.0)
// ==========================================
const TEAL = "#4A8B86"; // From HTML DS
const TEAL_BRIGHT = "#5EE5C3"; // For extreme highlights
const BG = "#000000";
const TEXT = "rgba(255, 255, 255, 0.95)";
const TEXT_MUTED = "rgba(255, 255, 255, 0.65)";
const TEXT_GHOST = "rgba(255, 255, 255, 0.25)";
const LINE = "rgba(255, 255, 255, 0.03)";
const LINE_STRONG = "rgba(255, 255, 255, 0.08)";

const formatCurrency = (val: number) => `$${val.toFixed(2)}B`;

// ==========================================
// 1. STARDOG NETWORK GRAPH (Asset Allocation)
// ==========================================
const NODES = [
  { id: "EQ", label: "Equities", percent: 45, val: 3.54, angle: -Math.PI / 2 },
  {
    id: "FI",
    label: "Fixed Inc.",
    percent: 25,
    val: 1.97,
    angle: -Math.PI / 2 + Math.PI * 2 * 0.2,
  },
  {
    id: "RE",
    label: "Real Estate",
    percent: 15,
    val: 1.18,
    angle: -Math.PI / 2 + Math.PI * 2 * 0.4,
  },
  { id: "CM", label: "Commod.", percent: 10, val: 0.79, angle: -Math.PI / 2 + Math.PI * 2 * 0.6 },
  { id: "CH", label: "Cash", percent: 5, val: 0.39, angle: -Math.PI / 2 + Math.PI * 2 * 0.8 },
];

const NetworkAllocation = () => {
  const [hovered, setHovered] = useState<string | null>(null);

  const size = 320;
  const center = size / 2;
  const radius = 100;

  return (
    <div className="flex flex-col w-full h-full gap-8">
      <div className="relative flex items-center justify-center w-full h-[320px]">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="overflow-visible"
        >
          {/* Radar Sweep Background */}
          <defs>
            <radialGradient id="radar-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={TEAL} stopOpacity="0.1" />
              <stop offset="100%" stopColor={TEAL} stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx={center} cy={center} r={radius * 1.4} fill="url(#radar-glow)" />
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={LINE_STRONG}
            strokeDasharray="4 4"
          />
          <circle cx={center} cy={center} r={radius * 1.5} fill="none" stroke={LINE} />

          {/* Animated radar sweep line */}
          <motion.line
            x1={center}
            y1={center}
            x2={center}
            y2={center - radius * 1.5}
            stroke={TEAL}
            strokeWidth="1"
            opacity="0.3"
            animate={{ rotate: 360 }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            style={{ originX: "50%", originY: "50%" }}
          />

          {/* Links */}
          {NODES.map((node, i) => {
            const x = center + Math.cos(node.angle) * radius;
            const y = center + Math.sin(node.angle) * radius;
            const isHovered = hovered === node.id || hovered === null;
            return (
              <motion.line
                key={`link-${node.id}`}
                x1={center}
                y1={center}
                x2={x}
                y2={y}
                stroke={isHovered ? TEAL : LINE_STRONG}
                strokeWidth={isHovered ? 1.5 : 1}
                strokeDasharray={isHovered ? "none" : "2 2"}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.1 }}
              />
            );
          })}

          {/* Nodes */}
          {NODES.map((node, i) => {
            const x = center + Math.cos(node.angle) * radius;
            const y = center + Math.sin(node.angle) * radius;
            const isHovered = hovered === node.id;
            const isDimmed = hovered !== null && !isHovered;

            return (
              <g
                key={`node-${node.id}`}
                className="cursor-pointer"
                onMouseEnter={() => setHovered(node.id)}
                onMouseLeave={() => setHovered(null)}
              >
                <circle
                  cx={x}
                  cy={y}
                  r={14}
                  fill={BG}
                  stroke={isHovered ? TEAL_BRIGHT : LINE_STRONG}
                  strokeWidth="1.5"
                  className="transition-colors"
                />
                {isHovered && (
                  <circle
                    cx={x}
                    cy={y}
                    r={22}
                    fill="none"
                    stroke={TEAL}
                    strokeWidth="1"
                    strokeDasharray="2 4"
                    className="animate-spin-slow"
                    style={{ transformOrigin: `${x}px ${y}px` }}
                  />
                )}
                <circle
                  cx={x}
                  cy={y}
                  r={3}
                  fill={isHovered ? TEAL_BRIGHT : TEXT_GHOST}
                  className="transition-colors"
                />

                {/* Node Label */}
                <foreignObject
                  x={x > center ? x + 20 : x - 120}
                  y={y - 12}
                  width="100"
                  height="40"
                  className="overflow-visible pointer-events-none"
                >
                  <div className={`flex flex-col ${x > center ? "items-start" : "items-end"}`}>
                    <span
                      className={`font-mono text-[10px] uppercase tracking-[0.2em] transition-colors ${isHovered ? "text-[" + TEAL_BRIGHT + "]" : "text-[" + TEXT_MUTED + "]"}`}
                    >
                      {node.label}
                    </span>
                    <span
                      className={`font-mono text-xs transition-colors ${isDimmed ? "text-[" + TEXT_GHOST + "]" : "text-white"}`}
                    >
                      {node.percent}%
                    </span>
                  </div>
                </foreignObject>
              </g>
            );
          })}

          {/* Center Core Node */}
          <g
            className="cursor-pointer"
            onMouseEnter={() => setHovered("CENTER")}
            onMouseLeave={() => setHovered(null)}
          >
            <circle
              cx={center}
              cy={center}
              r={36}
              fill={BG}
              stroke={hovered === "CENTER" ? TEAL_BRIGHT : LINE_STRONG}
              strokeWidth="2"
              className="transition-colors"
            />
            <circle
              cx={center}
              cy={center}
              r={44}
              fill="none"
              stroke={TEAL}
              strokeWidth="1"
              opacity={0.4}
              className="animate-ping"
              style={{ transformOrigin: `${center}px ${center}px` }}
            />
            <circle
              cx={center}
              cy={center}
              r={4}
              fill={TEAL_BRIGHT}
              className="drop-shadow-[0_0_10px_#5EE5C3]"
            />
          </g>
        </svg>

        {/* Center Text HTML */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-20">
          <span className="font-mono text-[9px] text-[#4A8B86] uppercase tracking-[0.3em] bg-black px-2">
            Total
          </span>
          <span className="font-sans font-light text-2xl text-white bg-black px-2 py-1 mt-1 tracking-tight">
            7.88B
          </span>
        </div>
      </div>

      {/* Ghost Menu Style Legend */}
      <div className="flex flex-col gap-0 border-t border-[rgba(255,255,255,0.03)] pt-4">
        {NODES.map((item) => {
          const isHovered = hovered === item.id;
          const isDimmed = hovered !== null && !isHovered && hovered !== "CENTER";

          return (
            <div
              key={item.id}
              onMouseEnter={() => setHovered(item.id)}
              onMouseLeave={() => setHovered(null)}
              className="flex items-center justify-between py-3 cursor-pointer border-b border-[rgba(255,255,255,0.03)] last:border-0 transition-all hover:pl-3 group"
            >
              <div className="flex items-center gap-4">
                <span
                  className={`font-mono text-[10px] transition-colors ${isHovered ? "text-[" + TEAL_BRIGHT + "]" : "text-[" + TEXT_GHOST + "]"}`}
                >
                  {item.id}
                </span>
                <span
                  className={`text-sm font-medium transition-colors ${isHovered ? "text-white" : "text-[" + TEXT_MUTED + "]"} ${isDimmed ? "opacity-30" : ""}`}
                >
                  {item.label}
                </span>
              </div>
              <div
                className={`flex items-baseline gap-4 transition-opacity ${isDimmed ? "opacity-30" : ""}`}
              >
                <span className="font-mono text-[10px] text-[rgba(255,255,255,0.4)]">
                  {item.percent}%
                </span>
                <span
                  className={`font-mono text-sm transition-colors ${isHovered ? "text-[" + TEAL_BRIGHT + "]" : "text-white"}`}
                >
                  {formatCurrency(item.val)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ==========================================
// 2. TACTICAL HUD PERFORMANCE TREND
// ==========================================
const AREA_DATA = Array.from({ length: 60 }).map((_, i) => {
  const base = 40 + Math.sin(i * 0.15) * 40 + Math.cos(i * 0.4) * 15;
  return Math.max(5, Math.min(100, base + (Math.random() - 0.5) * 10));
});

const TacticalTrend = () => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dim, setDim] = useState({ w: 800, h: 300 });

  useEffect(() => {
    if (svgRef.current) setDim({ w: svgRef.current.clientWidth, h: svgRef.current.clientHeight });
  }, []);

  const { w, h } = dim;
  const pad = { t: 20, b: 30, l: 0, r: 0 };
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;
  const step = iw / (AREA_DATA.length - 1);
  const max = 100;

  const pts = AREA_DATA.map((v, i) => ({
    x: pad.l + i * step,
    y: pad.t + ih - (v / max) * ih,
    v,
  }));

  const path = pts.reduce((acc, pt, i) => {
    if (i === 0) return `M ${pt.x},${pt.y}`;
    const cp1x = pts[i - 1].x + (pt.x - pts[i - 1].x) / 3;
    const cp2x = pt.x - (pt.x - pts[i - 1].x) / 3;
    return `${acc} C ${cp1x},${pts[i - 1].y} ${cp2x},${pt.y} ${pt.x},${pt.y}`;
  }, "");

  const handleMove = (e: React.MouseEvent) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - pad.l;
    const idx = Math.max(0, Math.min(Math.round(x / step), AREA_DATA.length - 1));
    setHoverIdx(idx);
  };

  return (
    <div className="relative w-full h-full flex flex-col pt-4">
      {/* HUD Header Overlay */}
      <div className="absolute top-0 left-0 right-0 flex justify-between items-start pointer-events-none z-10">
        <div>
          <div className="font-mono text-[10px] text-[#4A8B86] uppercase tracking-[0.2em] mb-2">
            Live_Feed // PRF-89
          </div>
          <div className="font-sans font-light text-4xl text-white tracking-tight">
            {hoverIdx !== null
              ? `$${(AREA_DATA[hoverIdx] * 1.2).toFixed(2)}M`
              : `$${(AREA_DATA[AREA_DATA.length - 1] * 1.2).toFixed(2)}M`}
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[10px] text-[rgba(255,255,255,0.4)] uppercase tracking-[0.2em] mb-2">
            Variance
          </div>
          <div className="font-mono text-sm text-[#5EE5C3]">+14.2%</div>
        </div>
      </div>

      <div className="flex-1 relative mt-16" onMouseLeave={() => setHoverIdx(null)}>
        <svg ref={svgRef} className="w-full h-full overflow-visible" onMouseMove={handleMove}>
          <defs>
            <linearGradient id="trendArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={TEAL} stopOpacity="0.25" />
              <stop offset="100%" stopColor={TEAL} stopOpacity="0" />
            </linearGradient>
            <pattern id="scanlines" width="4" height="4" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="4" y2="0" stroke={LINE} strokeWidth="1" />
            </pattern>
          </defs>

          {/* Background Grid */}
          <rect x={pad.l} y={pad.t} width={iw} height={ih} fill="url(#scanlines)" />

          {/* X/Y Axes HUD style */}
          <path
            d={`M ${pad.l},${pad.t} L ${pad.l},${pad.t + ih} L ${pad.l + iw},${pad.t + ih}`}
            fill="none"
            stroke={LINE_STRONG}
            strokeWidth="1"
          />

          {/* Tick marks Y */}
          {Array.from({ length: 5 }).map((_, i) => (
            <line
              key={`y-${i}`}
              x1={pad.l}
              y1={pad.t + (ih / 4) * i}
              x2={pad.l - 6}
              y2={pad.t + (ih / 4) * i}
              stroke={TEXT_GHOST}
              strokeWidth="1"
            />
          ))}
          {/* Tick marks X */}
          {Array.from({ length: 12 }).map((_, i) => (
            <line
              key={`x-${i}`}
              x1={pad.l + (iw / 11) * i}
              y1={pad.t + ih}
              x2={pad.l + (iw / 11) * i}
              y2={pad.t + ih + 6}
              stroke={TEXT_GHOST}
              strokeWidth="1"
            />
          ))}

          {/* Area */}
          <path
            d={`${path} L ${pts[pts.length - 1].x},${pad.t + ih} L ${pts[0].x},${pad.t + ih} Z`}
            fill="url(#trendArea)"
          />

          {/* Line */}
          <motion.path
            d={path}
            fill="none"
            stroke={TEAL_BRIGHT}
            strokeWidth="1.5"
            className="drop-shadow-[0_0_8px_rgba(94,229,195,0.6)]"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 2.5, ease: "easeOut" }}
          />

          {/* Animated Sweeper Line */}
          <motion.line
            x1={pad.l}
            y1={pad.t}
            x2={pad.l}
            y2={pad.t + ih}
            stroke={TEAL}
            strokeWidth="1"
            opacity="0.5"
            animate={{ x1: [pad.l, pad.l + iw], x2: [pad.l, pad.l + iw] }}
            transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
          />

          {hoverIdx !== null && (
            <g>
              <line
                x1={pts[hoverIdx].x}
                y1={pad.t}
                x2={pts[hoverIdx].x}
                y2={pad.t + ih}
                stroke={TEXT_GHOST}
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <circle
                cx={pts[hoverIdx].x}
                cy={pts[hoverIdx].y}
                r="4"
                fill={BG}
                stroke={TEAL_BRIGHT}
                strokeWidth="1.5"
                className="drop-shadow-[0_0_10px_#5EE5C3]"
              />
              <rect
                x={pts[hoverIdx].x - 24}
                y={pad.t + ih + 12}
                width="48"
                height="20"
                fill={BG}
                stroke={LINE_STRONG}
              />
              <text
                x={pts[hoverIdx].x}
                y={pad.t + ih + 25}
                fill={TEXT}
                fontSize="10"
                fontFamily="monospace"
                textAnchor="middle"
              >
                T-{AREA_DATA.length - hoverIdx}
              </text>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
};

// ==========================================
// 3. HUD GAUGES (KPI)
// ==========================================
const HudGauge = ({ label, value, percent, color = TEAL_BRIGHT }: any) => {
  return (
    <div className="flex flex-col gap-3 group cursor-default">
      <div className="flex justify-between items-baseline">
        <span className="font-mono text-[10px] text-[rgba(255,255,255,0.4)] uppercase tracking-[0.2em]">
          {label}
        </span>
        <span className="font-sans font-light text-2xl text-white tracking-tight">{value}</span>
      </div>
      <div className="h-[2px] bg-[rgba(255,255,255,0.08)] w-full relative overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0"
          style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }}
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        />
      </div>
    </div>
  );
};

// ==========================================
// 4. METRIC CARD WRAPPER (Ghost Protocol Shell)
// ==========================================
const HudCard = ({ title, children, kicker = "SYS_NOMINAL", className = "" }: any) => {
  return (
    <div
      className={`relative border border-[rgba(255,255,255,0.08)] bg-black flex flex-col p-8 overflow-hidden group ${className}`}
    >
      {/* Corner brackets (UI High-tech) */}
      <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-[rgba(255,255,255,0.3)]" />
      <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-[rgba(255,255,255,0.3)]" />
      <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-[rgba(255,255,255,0.3)]" />
      <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-[rgba(255,255,255,0.3)]" />

      <div className="flex justify-between items-center mb-8 relative z-10 border-b border-[rgba(255,255,255,0.08)] pb-4">
        <span className="font-mono text-[11px] text-[rgba(255,255,255,0.65)] uppercase tracking-widest">
          {title}
        </span>
        <span className="font-mono text-[10px] text-[#4A8B86] tracking-[0.2em] uppercase">
          {kicker}
        </span>
      </div>

      <div className="flex-1 relative z-10">{children}</div>
    </div>
  );
};

// ==========================================
// SCENE ASSEMBLY
// ==========================================
export const ChartsScene = () => {
  return (
    <div className="min-h-screen p-0 w-full relative bg-black flex overflow-hidden font-sans text-[rgba(255,255,255,0.95)]">
      {/* The Void Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(rgba(74, 139, 134, 0.01) 1px, transparent 1px), linear-gradient(90deg, rgba(74, 139, 134, 0.01) 1px, transparent 1px)",
            backgroundSize: "100px 100px",
            maskImage: "radial-gradient(circle at 50% 50%, black, transparent 80%)",
          }}
        />
      </div>

      {/* The Rail (Sidebar) */}
      <aside className="w-[72px] border-r border-[rgba(255,255,255,0.03)] flex flex-col items-center py-10 gap-12 z-10 bg-black">
        <div className="w-10 h-10 flex items-center justify-center text-[#4A8B86] relative cursor-pointer">
          <div className="absolute inset-[-4px] border border-[#4A8B86] rounded-full opacity-20 animate-pulse" />
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          </svg>
        </div>
        <div className="w-10 h-10 flex items-center justify-center text-[rgba(255,255,255,0.25)] hover:text-white transition-all hover:scale-110 cursor-pointer">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h7" />
            <path d="M16 19h6" />
            <path d="M19 16v6" />
          </svg>
        </div>
        <div className="w-10 h-10 flex items-center justify-center text-[rgba(255,255,255,0.25)] hover:text-white transition-all hover:scale-110 cursor-pointer">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
        </div>

        <div className="w-10 h-10 flex items-center justify-center text-[#ff3333] opacity-40 hover:opacity-100 transition-all cursor-pointer mt-auto">
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
      </aside>

      {/* Main Canvas */}
      <main className="flex-1 flex flex-col z-10 overflow-y-auto">
        {/* Header Bar */}
        <div className="px-20 py-10 flex justify-between items-end">
          <div>
            <span className="font-mono text-[10px] tracking-[0.8em] text-[#4A8B86] uppercase block mb-6">
              Protocol_Active
            </span>
            <h1 className="text-[140px] font-black tracking-[-0.08em] leading-[0.7] text-[rgba(255,255,255,0.25)] uppercase m-0 pointer-events-none">
              Hearst
            </h1>
          </div>
          <div className="text-right">
            <span className="font-mono text-[10px] text-[rgba(255,255,255,0.65)] uppercase tracking-[0.2em] block mb-2">
              System_Load
            </span>
            <div className="text-lg font-light tracking-tight text-white">0.042ms</div>
          </div>
        </div>

        {/* Content Grid */}
        <div className="flex-1 grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-px bg-[rgba(255,255,255,0.03)] border-t border-[rgba(255,255,255,0.03)]">
          {/* Main Zone */}
          <div className="bg-black p-20 flex flex-col gap-20">
            <section>
              <HudCard title="01 // Intelligence_Stream" kicker="SYS_SECURE" className="h-[460px]">
                <TacticalTrend />
              </HudCard>
            </section>

            <section className="grid grid-cols-2 gap-16">
              <HudCard title="02 // Asset_Network" kicker="NODE_MAP" className="h-[560px]">
                <NetworkAllocation />
              </HudCard>

              <div className="flex flex-col gap-12 pt-4">
                <span className="font-mono text-[11px] text-[rgba(255,255,255,0.65)] uppercase tracking-widest border-b border-[rgba(255,255,255,0.08)] pb-4">
                  System_HUD
                </span>
                <HudGauge label="Neural_Engine" value="75%" percent={75} />
                <HudGauge label="Memory_Buffer" value="32%" percent={32} />
                <HudGauge label="Network_I/O" value="89%" percent={89} color="#ffcc00" />
                <HudGauge label="Security_Core" value="99%" percent={99} />
              </div>
            </section>
          </div>

          {/* Side Zone */}
          <div className="bg-black p-10 flex flex-col border-l border-[rgba(255,255,255,0.03)]">
            <span className="font-mono text-[11px] text-[rgba(255,255,255,0.65)] uppercase tracking-widest border-b border-[rgba(255,255,255,0.08)] pb-4 mb-8">
              Quick_Access
            </span>
            <div className="flex flex-col gap-[2px]">
              {[
                { l: "View_Logs", k: "CTRL+L" },
                { l: "Network_Map", k: "CTRL+N" },
                { l: "Security_Vault", k: "CTRL+S" },
                { l: "Terminal_Shell", k: "CTRL+T" },
              ].map((m) => (
                <div
                  key={m.l}
                  className="flex justify-between items-center py-4 border-b border-[rgba(255,255,255,0.03)] cursor-pointer hover:pl-3 hover:border-b-[#4A8B86] transition-all group"
                >
                  <span className="text-sm font-medium text-[rgba(255,255,255,0.65)] group-hover:text-white transition-colors">
                    {m.l}
                  </span>
                  <span className="font-mono text-[10px] text-[rgba(255,255,255,0.25)] group-hover:text-[#4A8B86] transition-colors">
                    {m.k}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-auto pt-10">
              <span className="font-mono text-[11px] text-[rgba(255,255,255,0.65)] uppercase tracking-widest border-b border-[rgba(255,255,255,0.08)] pb-4 mb-8 block">
                Live_Feed
              </span>
              <div className="flex flex-col gap-12">
                <div className="flex flex-col gap-2">
                  <span className="font-mono text-[10px] text-[rgba(255,255,255,0.4)] uppercase tracking-[0.2em]">
                    Success_Rate
                  </span>
                  <span className="text-4xl font-light tracking-tight text-white">99.8%</span>
                  <span className="font-mono text-[10px] text-[#4A8B86] uppercase">
                    +0.2% vs last_run
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  <span className="font-mono text-[10px] text-[rgba(255,255,255,0.4)] uppercase tracking-[0.2em]">
                    Active_Missions
                  </span>
                  <span className="text-4xl font-light tracking-tight text-white">12</span>
                  <span className="font-mono text-[10px] text-[#4A8B86] uppercase">
                    All_Nominal
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Command Bar */}
        <div className="sticky bottom-0 bg-linear-to-t from-black via-black to-transparent pt-[60px] pb-10 px-20">
          <div className="flex items-center gap-6 border-b border-[rgba(255,255,255,0.08)] pb-4">
            <span className="font-mono text-xs text-[#4A8B86]">HEARST_OS &gt;</span>
            <input
              type="text"
              className="bg-transparent border-none flex-1 text-white text-2xl font-sans outline-none placeholder:text-[rgba(255,255,255,0.25)]"
              placeholder="Enter_Command_"
            />
          </div>
        </div>
      </main>
    </div>
  );
};
