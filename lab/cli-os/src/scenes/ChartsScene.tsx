import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import React, { useEffect, useRef, useState } from "react";

// ==========================================
// TOKENS & UTILS
// ==========================================
const TEAL = "#5EE5C3";
const TEAL_RGB = "94, 229, 195";

const formatCurrency = (val: number) => `$${val.toFixed(2)}M`;
const formatCompact = (val: number) => {
  if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
  return val.toFixed(0);
};

// ==========================================
// 1. QUANTUM AREA CHART (Performance Trend)
// ==========================================
const AREA_DATA = Array.from({ length: 40 }).map((_, i) => {
  const base = 50 + Math.sin(i * 0.25) * 30 + Math.cos(i * 0.5) * 10;
  return Math.max(10, Math.min(100, base + (Math.random() - 0.5) * 8));
});

// Benchmark line data
const BENCHMARK_DATA = Array.from({ length: 40 }).map((_, i) => {
  return 40 + i * 0.8 + Math.sin(i * 0.1) * 5;
});

const QuantumAreaChart = () => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 280 });

  // Use springs for smooth crosshair movement
  const mouseX = useMotionValue(0);
  const smoothX = useSpring(mouseX, { damping: 25, stiffness: 200 });

  useEffect(() => {
    if (svgRef.current) {
      const { width, height } = svgRef.current.getBoundingClientRect();
      setDimensions({ width, height });
    }
  }, []);

  const { width, height } = dimensions;
  const padding = { top: 30, bottom: 40, left: 40, right: 20 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const stepX = innerWidth / (AREA_DATA.length - 1);
  const maxVal = 100; // Fixed max
  const minVal = 0; // Fixed min
  const range = maxVal - minVal;

  const getPoints = (data: number[]) =>
    data.map((val, i) => ({
      x: padding.left + i * stepX,
      y: padding.top + innerHeight - ((val - minVal) / range) * innerHeight,
      val,
    }));

  const points = getPoints(AREA_DATA);
  const benchPoints = getPoints(BENCHMARK_DATA);

  const getPath = (pts: typeof points, isArea = false) => {
    if (pts.length === 0) return "";
    let d = `M ${pts[0].x},${pts[0].y} `;
    for (let i = 0; i < pts.length - 1; i++) {
      const cp1x = pts[i].x + (pts[i + 1].x - pts[i].x) / 3;
      const cp2x = pts[i + 1].x - (pts[i + 1].x - pts[i].x) / 3;
      d += `C ${cp1x},${pts[i].y} ${cp2x},${pts[i + 1].y} ${pts[i + 1].x},${pts[i + 1].y} `;
    }
    if (isArea) {
      d += `L ${pts[pts.length - 1].x},${height - padding.bottom} L ${pts[0].x},${height - padding.bottom} Z`;
    }
    return d;
  };

  const areaPath = getPath(points, true);
  const linePath = getPath(points);
  const benchPath = getPath(benchPoints);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const boundedX = Math.max(padding.left, Math.min(x, width - padding.right));
    mouseX.set(boundedX);

    const idx = Math.round((boundedX - padding.left) / stepX);
    setHoverIdx(Math.max(0, Math.min(idx, AREA_DATA.length - 1)));
  };

  // Generate Y axis ticks
  const yTicks = [0, 25, 50, 75, 100];
  const xTicks = [0, 10, 20, 30, 39];

  return (
    <div className="relative w-full h-full flex flex-col min-h-[300px]">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-0.5 bg-[#5EE5C3] shadow-[0_0_8px_#5EE5C3]" />
            <span className="text-xs text-white/80 font-medium">Portfolio</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-0.5 bg-white/30 border-t border-dashed border-white/50" />
            <span className="text-xs text-white/50 font-medium">Benchmark S&P</span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-2xl font-mono text-white leading-none tracking-tight">
            {hoverIdx !== null
              ? formatCurrency(AREA_DATA[hoverIdx])
              : formatCurrency(AREA_DATA[AREA_DATA.length - 1])}
          </span>
          <div className="text-[10px] text-[#5EE5C3] font-mono tracking-widest">+12.4% YTD</div>
        </div>
      </div>

      <div className="flex-1 relative" onMouseLeave={() => setHoverIdx(null)}>
        <svg ref={svgRef} className="w-full h-full overflow-visible" onMouseMove={handleMouseMove}>
          <defs>
            <linearGradient id="areaGlow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={TEAL} stopOpacity="0.4" />
              <stop offset="50%" stopColor={TEAL} stopOpacity="0.1" />
              <stop offset="100%" stopColor={TEAL} stopOpacity="0" />
            </linearGradient>
            <linearGradient id="lineGlow" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={TEAL} stopOpacity="0.2" />
              <stop offset="50%" stopColor={TEAL} stopOpacity="1" />
              <stop offset="100%" stopColor={TEAL} stopOpacity="0.8" />
            </linearGradient>
          </defs>

          {/* Grid Y */}
          {yTicks.map((val) => {
            const y = padding.top + innerHeight - ((val - minVal) / range) * innerHeight;
            return (
              <g key={val}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="rgba(255,255,255,0.04)"
                  strokeWidth="1"
                />
                <text
                  x={padding.left - 10}
                  y={y + 3}
                  fill="rgba(255,255,255,0.3)"
                  fontSize="10"
                  fontFamily="monospace"
                  textAnchor="end"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Benchmark Line */}
          <path
            d={benchPath}
            fill="none"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />

          {/* Main Area & Line */}
          <path d={areaPath} fill="url(#areaGlow)" />
          <path
            d={linePath}
            fill="none"
            stroke="url(#lineGlow)"
            strokeWidth="2.5"
            className="drop-shadow-[0_2px_8px_rgba(94,229,195,0.6)]"
          />

          {/* Crosshair & Tooltips */}
          {hoverIdx !== null && (
            <motion.g style={{ x: smoothX }}>
              {/* Vertical crosshair line */}
              <line
                x1={0}
                y1={padding.top}
                x2={0}
                y2={height - padding.bottom}
                stroke="rgba(255,255,255,0.4)"
                strokeWidth="1"
                strokeDasharray="2 2"
              />

              {/* Data Point Highlighter - Portfolio */}
              <motion.circle
                cx={0}
                animate={{ cy: points[hoverIdx].y }}
                transition={{ type: "spring", damping: 20, stiffness: 300 }}
                r="4.5"
                fill="#000"
                stroke={TEAL}
                strokeWidth="2.5"
                className="drop-shadow-[0_0_12px_rgba(94,229,195,1)]"
              />

              {/* Data Point Highlighter - Benchmark */}
              <motion.circle
                cx={0}
                animate={{ cy: benchPoints[hoverIdx].y }}
                transition={{ type: "spring", damping: 20, stiffness: 300 }}
                r="3"
                fill="#000"
                stroke="rgba(255,255,255,0.8)"
                strokeWidth="1.5"
              />
            </motion.g>
          )}

          {/* X Axis Ticks */}
          {xTicks.map((idx) => (
            <text
              key={idx}
              x={points[idx].x}
              y={height - 10}
              fill="rgba(255,255,255,0.3)"
              fontSize="10"
              fontFamily="monospace"
              textAnchor="middle"
            >
              Day {idx + 1}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
};

// ==========================================
// 2. ORBITAL ASSET ALLOCATION (Concentric Rings)
// ==========================================
const ORBITAL_DATA = [
  { id: "EQ", label: "Equities", percent: 45, val: 3.54, color: "rgba(94, 229, 195, 1)" },
  { id: "FI", label: "Fixed Income", percent: 25, val: 1.97, color: "rgba(94, 229, 195, 0.75)" },
  { id: "RE", label: "Real Estate", percent: 15, val: 1.18, color: "rgba(94, 229, 195, 0.5)" },
  { id: "CM", label: "Commodities", percent: 10, val: 0.79, color: "rgba(94, 229, 195, 0.3)" },
  { id: "CH", label: "Cash", percent: 5, val: 0.39, color: "rgba(94, 229, 195, 0.15)" },
];

const OrbitalAllocation = () => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const size = 260;
  const center = size / 2;
  const baseRadius = 40;
  const trackGap = 16;

  const hoveredItem = ORBITAL_DATA.find((d) => d.id === hoveredId);

  return (
    <div className="flex w-full h-full items-center justify-between gap-8 pl-4">
      {/* Chart */}
      <div
        className="relative flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-90"
        >
          {ORBITAL_DATA.map((item, i) => {
            const r = baseRadius + i * trackGap;
            const circumference = 2 * Math.PI * r;
            const dasharray = `${(item.percent * circumference) / 100} ${circumference}`;
            const isHovered = hoveredId === item.id;
            const isOtherHovered = hoveredId !== null && !isHovered;

            return (
              <g key={item.id}>
                {/* Background Track */}
                <circle
                  cx={center}
                  cy={center}
                  r={r}
                  fill="none"
                  stroke="rgba(255,255,255,0.03)"
                  strokeWidth={isHovered ? 12 : 8}
                  className="transition-all duration-300"
                />
                {/* Progress Track */}
                <motion.circle
                  cx={center}
                  cy={center}
                  r={r}
                  fill="none"
                  stroke={item.color}
                  strokeWidth={isHovered ? 12 : 8}
                  strokeLinecap="round"
                  strokeDasharray={dasharray}
                  initial={{ strokeDashoffset: circumference }}
                  animate={{
                    strokeDashoffset: 0,
                    opacity: isOtherHovered ? 0.3 : 1,
                  }}
                  transition={{
                    strokeDashoffset: { duration: 2, ease: "easeOut", delay: i * 0.1 },
                    opacity: { duration: 0.2 },
                    strokeWidth: { duration: 0.2 },
                  }}
                  className={`cursor-pointer ${isHovered ? "drop-shadow-[0_0_12px_rgba(94,229,195,0.5)]" : ""}`}
                  onMouseEnter={() => setHoveredId(item.id)}
                  onMouseLeave={() => setHoveredId(null)}
                />
              </g>
            );
          })}
        </svg>

        {/* Center Target Info */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <AnimatePresence mode="wait">
            {hoveredItem ? (
              <motion.div
                key="hover"
                initial={{ opacity: 0, scale: 0.8, filter: "blur(4px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0.8, filter: "blur(4px)" }}
                transition={{ duration: 0.2 }}
                className="flex flex-col items-center"
              >
                <span className="text-[10px] text-[#5EE5C3] uppercase tracking-widest font-medium mb-0.5">
                  {hoveredItem.id}
                </span>
                <span className="text-xl font-mono text-white tracking-tight">
                  {hoveredItem.percent}%
                </span>
              </motion.div>
            ) : (
              <motion.div
                key="default"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-1.5 h-1.5 rounded-full bg-white/20"
              />
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* High-End Legend Table */}
      <div className="flex flex-col flex-1 gap-1">
        {ORBITAL_DATA.map((item, i) => {
          const isHovered = hoveredId === item.id;
          const isOtherHovered = hoveredId !== null && !isHovered;

          return (
            <div
              key={item.id}
              onMouseEnter={() => setHoveredId(item.id)}
              onMouseLeave={() => setHoveredId(null)}
              className="flex items-center justify-between py-2 px-3 rounded-lg transition-all duration-300 cursor-pointer relative overflow-hidden group"
            >
              {/* Hover Highlight Background */}
              <div
                className={`absolute inset-0 bg-white/5 transition-opacity duration-300 ${isHovered ? "opacity-100" : "opacity-0"}`}
              />

              <div className="flex items-center gap-3 relative z-10">
                <div className="relative flex items-center justify-center w-4 h-4">
                  <motion.div
                    className="absolute rounded-full border border-[#5EE5C3]"
                    initial={false}
                    animate={{
                      width: isHovered ? 16 : 8,
                      height: isHovered ? 16 : 8,
                      opacity: isHovered ? 1 : 0,
                    }}
                  />
                  <div
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${isHovered ? "shadow-[0_0_8px_rgba(94,229,195,0.8)]" : ""}`}
                    style={{ backgroundColor: item.color }}
                  />
                </div>
                <div className="flex flex-col">
                  <span
                    className={`text-sm transition-colors ${isHovered ? "text-white font-medium" : "text-white/70"} ${isOtherHovered ? "text-white/30" : ""}`}
                  >
                    {item.label}
                  </span>
                </div>
              </div>

              <div
                className={`flex flex-col items-end relative z-10 transition-opacity ${isOtherHovered ? "opacity-30" : "opacity-100"}`}
              >
                <span
                  className={`font-mono text-sm ${isHovered ? "text-[#5EE5C3]" : "text-white"}`}
                >
                  {formatCurrency(item.val)}
                </span>
                <span className="text-[10px] text-white/40 font-mono">{item.percent}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ==========================================
// 3. VOLUME DENSITY (Candlestick / Histogram hybrid)
// ==========================================
const DENSITY_DATA = Array.from({ length: 30 }).map((_, i) => {
  const base = Math.sin(i * 0.4) * 40 + 50;
  return {
    val: base + Math.random() * 20,
    avg: base,
  };
});

const VolumeDensity = () => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const max = Math.max(...DENSITY_DATA.map((d) => Math.max(d.val, d.avg)));

  return (
    <div className="flex flex-col h-full w-full relative">
      <div className="flex justify-between items-center mb-6">
        <span className="text-[10px] text-white/50 uppercase tracking-widest">30-Day Volume</span>
        <div className="flex items-center gap-2">
          <div className="w-2 h-0.5 bg-[#5EE5C3]" />
          <span className="text-[10px] text-[#5EE5C3] font-mono">MA(7)</span>
        </div>
      </div>

      <div className="flex-1 flex items-end justify-between gap-1 relative group">
        {/* Tooltip */}
        <AnimatePresence>
          {hoverIdx !== null && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute top-0 left-1/2 -translate-x-1/2 bg-[#111] border border-white/10 rounded px-3 py-2 flex gap-4 shadow-xl z-20 pointer-events-none"
            >
              <div className="flex flex-col">
                <span className="text-[9px] text-white/40 uppercase">Volume</span>
                <span className="text-xs font-mono text-white">
                  {formatCompact(DENSITY_DATA[hoverIdx].val * 1000)}
                </span>
              </div>
              <div className="w-px bg-white/10" />
              <div className="flex flex-col">
                <span className="text-[9px] text-[#5EE5C3]/60 uppercase">Average</span>
                <span className="text-xs font-mono text-[#5EE5C3]">
                  {formatCompact(DENSITY_DATA[hoverIdx].avg * 1000)}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Moving Average Line Overlay (SVG) */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
          preserveAspectRatio="none"
        >
          <path
            d={`M ${DENSITY_DATA.map((d, i) => `${(i / (DENSITY_DATA.length - 1)) * 100}% ${100 - (d.avg / max) * 100}%`).join(" L ")}`}
            fill="none"
            stroke="rgba(94,229,195,0.5)"
            strokeWidth="1.5"
            strokeDasharray="2 2"
          />
        </svg>

        {DENSITY_DATA.map((d, i) => {
          const isHovered = hoverIdx === i;
          const hPct = (d.val / max) * 100;
          return (
            <motion.div
              key={i}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              className="relative flex-1 rounded-sm cursor-pointer overflow-hidden flex items-end"
              style={{ height: "100%" }}
            >
              {/* Background track for hover */}
              {isHovered && <div className="absolute inset-0 bg-white/5 rounded-sm" />}

              {/* Actual bar */}
              <motion.div
                className="w-full relative rounded-sm"
                initial={{ height: "0%" }}
                animate={{ height: `${hPct}%` }}
                transition={{ duration: 0.8, delay: i * 0.02, ease: "easeOut" }}
                style={{
                  background: isHovered
                    ? `linear-gradient(to top, rgba(94,229,195,0.3), rgba(94,229,195,0.9))`
                    : `linear-gradient(to top, rgba(255,255,255,0.05), rgba(255,255,255,0.25))`,
                }}
              >
                <div
                  className={`absolute top-0 left-0 right-0 h-px ${isHovered ? "bg-[#5EE5C3] shadow-[0_0_8px_#5EE5C3]" : "bg-white/50"}`}
                />
              </motion.div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

// ==========================================
// 4. MICRO-INTERACTIVE KPI CARD
// ==========================================
const LiveKpiCard = ({ title, value, delta, isPositive, metric }: any) => {
  return (
    <div className="flex flex-col justify-between h-full group cursor-default">
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="relative flex h-1.5 w-1.5">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isPositive ? "bg-[#5EE5C3]" : "bg-white/50"}`}
              ></span>
              <span
                className={`relative inline-flex rounded-full h-1.5 w-1.5 ${isPositive ? "bg-[#5EE5C3]" : "bg-white/50"}`}
              ></span>
            </span>
            <span className="text-[10px] text-white/50 uppercase tracking-widest font-medium">
              {title}
            </span>
          </div>
          <span className="text-4xl font-mono text-white tracking-tight leading-none group-hover:text-[#5EE5C3] transition-colors drop-shadow-sm">
            {value}
          </span>
        </div>

        <div
          className={`px-2 py-0.5 rounded border flex items-center backdrop-blur-md ${isPositive ? "bg-[#5EE5C3]/10 border-[#5EE5C3]/30" : "bg-white/5 border-white/10"}`}
        >
          <span
            className={`text-[10px] font-mono font-medium ${isPositive ? "text-[#5EE5C3]" : "text-white/60"}`}
          >
            {isPositive ? "+" : ""}
            {delta}%
          </span>
        </div>
      </div>

      <div className="flex items-end justify-between mt-6 pt-4 border-t border-white/5">
        <span className="text-[10px] text-white/40 font-medium uppercase tracking-wider">
          {metric}
        </span>
        <div className="flex gap-0.5">
          {Array.from({ length: 16 }).map((_, i) => (
            <motion.div
              key={i}
              className={`w-1 rounded-full ${isPositive ? "bg-[#5EE5C3]/30" : "bg-white/10"}`}
              initial={{ height: 4 }}
              animate={{ height: 4 + Math.random() * 12 }}
              transition={{
                duration: 1 + Math.random(),
                repeat: Infinity,
                repeatType: "reverse",
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// WRAPPER CARD
// ==========================================
const ChartCard = ({
  title,
  Component,
  span = 1,
}: {
  title: string;
  Component: React.FC;
  span?: number;
}) => {
  return (
    <div
      className={`vision-glass rounded-[20px] p-6 lg:p-8 flex flex-col relative overflow-hidden border border-white/5 bg-linear-to-b from-white/3 to-transparent shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_-8px_rgba(0,0,0,0.5)] ${span === 2 ? "md:col-span-2" : ""}`}
      style={{ minHeight: "360px" }}
    >
      <div className="flex justify-between items-center z-10 mb-2 pointer-events-none">
        <h3 className="text-sm font-medium text-white/90 tracking-wide">{title}</h3>
      </div>
      <div className="flex-1 relative">
        <Component />
      </div>
    </div>
  );
};

// ==========================================
// SCENE
// ==========================================
export const ChartsScene = () => {
  return (
    <div className="min-h-screen p-6 md:p-10 lg:p-12 w-full mx-auto relative overflow-y-auto bg-[#030303] selection:bg-[#5EE5C3] selection:text-black">
      {/* High-end subtle noise / glow background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] right-[-10%] w-[80%] h-[800px] bg-[#5EE5C3] opacity-[0.015] blur-[160px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[600px] bg-white opacity-[0.01] blur-[120px] rounded-full mix-blend-screen" />
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 pl-2 border-b border-white/5 pb-6"
        >
          <div>
            <h1 className="text-3xl font-medium text-white mb-2 tracking-tight">
              Analytics Dashboard
            </h1>
            <p className="text-[#5EE5C3]/70 text-xs font-mono uppercase tracking-widest">
              Quantum Data Engine • Live
            </p>
          </div>

          {/* Main Controls */}
          <div className="vision-glass flex items-center p-1 rounded-lg shadow-inner mt-6 md:mt-0">
            <button className="px-5 py-1.5 text-xs font-medium text-black bg-white rounded-md shadow-[0_2px_8px_rgba(255,255,255,0.2)]">
              Overview
            </button>
            <button className="px-5 py-1.5 text-xs font-medium text-white/50 hover:text-white transition-colors">
              Metrics
            </button>
            <button className="px-5 py-1.5 text-xs font-medium text-white/50 hover:text-white transition-colors">
              Flows
            </button>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Row 1 */}
          <ChartCard title="Portfolio Performance" Component={QuantumAreaChart} span={2} />

          <ChartCard
            title="Total Revenue"
            Component={() => (
              <LiveKpiCard
                title="Total Revenue"
                value="$8.42M"
                delta="24.5"
                isPositive={true}
                metric="vs last quarter"
              />
            )}
          />

          {/* Row 2 */}
          <ChartCard title="Asset Distribution" Component={OrbitalAllocation} span={2} />

          <div className="flex flex-col gap-6">
            <div className="flex-1 vision-glass rounded-[20px] p-6 relative overflow-hidden border border-white/5 bg-linear-to-b from-white/3 to-transparent shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_-8px_rgba(0,0,0,0.5)]">
              <h3 className="text-sm font-medium text-white/90 tracking-wide mb-2">
                Volume Density
              </h3>
              <div className="h-[140px] relative">
                <VolumeDensity />
              </div>
            </div>
            <div className="flex-1 vision-glass rounded-[20px] p-6 relative overflow-hidden border border-white/5 bg-linear-to-b from-white/3 to-transparent shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_32px_-8px_rgba(0,0,0,0.5)]">
              <LiveKpiCard
                title="Active Traders"
                value="3,892"
                delta="1.2"
                isPositive={false}
                metric="Real-time heartbeat"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
