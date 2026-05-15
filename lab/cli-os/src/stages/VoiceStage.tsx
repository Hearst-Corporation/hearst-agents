import { useEffect, useRef } from "react";

const TEAL = "#4A8B86";

const BARS = [0.4, 0.7, 0.55, 0.9, 1.0, 0.85, 0.6, 0.75, 0.45];

export function VoiceStage() {
  const barsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const ids: ReturnType<typeof setInterval>[] = [];
    barsRef.current.forEach((bar, i) => {
      if (!bar) return;
      const base = BARS[i];
      const id = setInterval(
        () => {
          const h = base * 20 + Math.random() * 24;
          bar.style.height = `${h}px`;
        },
        120 + i * 30,
      );
      ids.push(id);
    });
    return () => ids.forEach(clearInterval);
  }, []);

  return (
    <div className="flex flex-col gap-16">
      {/* Header */}
      <div className="text-center">
        <span
          className="font-mono text-[10px] uppercase tracking-[0.15em]"
          style={{ color: "rgba(255,255,255,0.35)" }}
        >
          Voice · OpenAI Realtime · WebRTC actif
        </span>
      </div>

      {/* Voice sphere + UI — centré */}
      <div className="flex flex-col items-center gap-10">
        {/* Sphere */}
        <div
          className="relative flex items-center justify-center"
          style={{ width: 220, height: 220 }}
        >
          {/* Rings */}
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="absolute rounded-full animate-ping"
              style={{
                width: 110 + i * 36,
                height: 110 + i * 36,
                background: `radial-gradient(circle, ${TEAL}22 0%, transparent 70%)`,
                animationDuration: `${1.8 + i * 0.6}s`,
                animationDelay: `${i * 0.3}s`,
              }}
            />
          ))}
          {/* Core sphere */}
          <div
            className="rounded-full animate-pulse"
            style={{
              width: 110,
              height: 110,
              background: `radial-gradient(circle at 38% 35%, rgba(255,255,255,0.85) 0%, ${TEAL}55 50%, transparent 100%)`,
              animationDuration: "2.4s",
            }}
          />
        </div>

        {/* Status text */}
        <div
          className="text-2xl font-light text-center"
          style={{ color: "rgba(255,255,255,0.85)" }}
        >
          En écoute active
        </div>

        {/* Audio bars */}
        <div className="flex items-end gap-1.5" style={{ height: 40 }}>
          {BARS.map((_, i) => (
            <div
              key={i}
              ref={(el) => {
                barsRef.current[i] = el;
              }}
              className="rounded-full transition-all"
              style={{
                width: 4,
                height: BARS[i] * 20,
                background: TEAL,
                opacity: 0.7,
              }}
            />
          ))}
        </div>

        {/* Transcript */}
        <div
          className="flex flex-col gap-3 w-full max-w-md rounded-2xl px-5 py-4"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <p className="text-sm font-light" style={{ color: "rgba(255,255,255,0.55)" }}>
            Tu : Lance le briefing demain à 8h
          </p>
          <p className="text-sm font-light" style={{ color: "rgba(255,255,255,0.85)" }}>
            <span style={{ color: TEAL }}>Agent :</span> Briefing planifié pour demain 08:00. Je
            préparerai les sources ce soir à minuit.
          </p>
        </div>
      </div>
    </div>
  );
}
