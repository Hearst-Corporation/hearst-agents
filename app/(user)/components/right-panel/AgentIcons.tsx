"use client";

/**
 * AgentIcons — icônes SVG des 6 rôles agents.
 * Chaque icône accepte un prop `color` (token CSS ou hex).
 */

export function PulseIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <rect x="2"  y="10" width="3" height="6"  rx="1" fill={color} opacity={0.6} />
      <rect x="7"  y="5"  width="3" height="12" rx="1" fill={color} />
      <rect x="12" y="7"  width="3" height="9"  rx="1" fill={color} opacity={0.8} />
      <rect x="17" y="12" width="3" height="4"  rx="1" fill={color} opacity={0.5} />
    </svg>
  );
}

export function CortexIcon({ color = "currentColor" }: { color?: string }) {
  const r = 7;
  const cx = 11, cy = 11;
  const dots = Array.from({ length: 6 }, (_, i) => {
    const a = (i * 60 - 90) * (Math.PI / 180);
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={1.5} fill={color} opacity={i % 2 ? 0.6 : 1} />
      ))}
      <circle cx={cx} cy={cy} r={2} fill={color} opacity={0.9} />
    </svg>
  );
}

export function DelveIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="8" stroke={color} strokeWidth="1.5" strokeDasharray="3 2.5" />
      <circle cx="11" cy="11" r="4" stroke={color} strokeWidth="1" opacity={0.6} />
      <circle cx="11" cy="11" r="1.5" fill={color} />
    </svg>
  );
}

export function WardenIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <path
        d="M11 3 L19 6.5 V11.5 C19 15.5 15.5 18.8 11 20 C6.5 18.8 3 15.5 3 11.5 V6.5 L11 3Z"
        stroke={color} strokeWidth="1.5" strokeLinejoin="round"
      />
      <path d="M8 11 L10 13 L14 9" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ScribeIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <rect x="4" y="3" width="14" height="17" rx="2" stroke={color} strokeWidth="1.5" />
      <line x1="7"  y1="8"  x2="15" y2="8"  stroke={color} strokeWidth="1.2" strokeLinecap="round" />
      <line x1="7"  y1="11" x2="15" y2="11" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
      <line x1="7"  y1="14" x2="11" y2="14" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function PilotIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="8"   stroke={color} strokeWidth="1.5" />
      <circle cx="11" cy="11" r="4.5" stroke={color} strokeWidth="1" opacity={0.6} />
      <line x1="11"  y1="3"    x2="11"  y2="5.5"  stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="11"  y1="16.5" x2="11"  y2="19"   stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="3"   y1="11"   x2="5.5" y2="11"   stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="16.5" y1="11"  x2="19"  y2="11"   stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="11" cy="11" r="1.8" fill={color} />
    </svg>
  );
}

export const AGENT_ICON_MAP = {
  pulse:  PulseIcon,
  cortex: CortexIcon,
  delve:  DelveIcon,
  warden: WardenIcon,
  scribe: ScribeIcon,
  pilot:  PilotIcon,
} as const;
