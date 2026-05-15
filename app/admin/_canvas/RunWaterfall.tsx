"use client";

interface PersistedEvent {
  type: string;
  ts: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>;
}

interface Props {
  events: PersistedEvent[];
  isPlaying: boolean;
  progress: number;
  speed: number;
  onPlayToggle: () => void;
  onSpeedChange: (speed: number) => void;
  onReset: () => void;
  onSeek: (progress: number) => void;
  disabled: boolean;
}

const SPEEDS = [0.5, 1, 2, 4];

const EVENT_DOT: Record<string, string> = {
  run_created: "bg-(--accent-teal)",
  run_started: "bg-(--accent-teal)",
  run_completed: "bg-(--color-success)",
  run_failed: "bg-(--color-danger)",
  tool_call_started: "bg-(--accent-teal)",
  tool_call_completed: "bg-(--accent-teal)",
  delegate_enqueued: "bg-(--accent-agent)",
  delegate_completed: "bg-(--accent-agent)",
};

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function RunWaterfall({
  events,
  isPlaying,
  progress,
  speed,
  onPlayToggle,
  onSpeedChange,
  onReset,
  onSeek,
  disabled,
}: Props) {
  const total = events.length;
  const durationMs = total >= 2 ? events[total - 1].ts - events[0].ts : 0;

  const handleScrubberClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(p);
  };

  return (
    <div className="shrink-0 border-t border-line bg-surface px-(--space-6) py-(--space-3) flex flex-col gap-(--space-2)">
      {/* Scrubber */}
      <div
        role="slider"
        aria-label="Avancement du replay"
        aria-valuenow={Math.round(progress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        tabIndex={disabled ? -1 : 0}
        className={[
          "relative h-(--space-2) rounded-(--radius-pill) bg-line cursor-pointer overflow-hidden",
          disabled ? "opacity-40 pointer-events-none" : "hover:bg-line-strong",
        ].join(" ")}
        onClick={handleScrubberClick}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "ArrowRight") onSeek(Math.min(1, progress + 0.05));
          if (e.key === "ArrowLeft") onSeek(Math.max(0, progress - 0.05));
        }}
      >
        <div
          className="absolute inset-y-0 left-0 bg-(--accent-teal)/70 transition-[width] duration-(--duration-base)"
          style={{ width: `${progress * 100}%` }}
        />
        {/* Ticks événements */}
        {total > 1 &&
          events.map((ev, i) => {
            const pos = i / (total - 1);
            const dotClass = EVENT_DOT[ev.type] ?? "bg-text-ghost";
            return (
              <div
                key={i}
                className={[
                  "absolute top-1/2 -translate-y-1/2 w-1 h-1 rounded-(--radius-pill)",
                  dotClass,
                ].join(" ")}
                style={{ left: `${pos * 100}%` }}
              />
            );
          })}
      </div>

      {/* Contrôles */}
      <div className="flex items-center gap-(--space-4)">
        <div className="flex items-center gap-(--space-2) shrink-0">
          {/* Rembobiner */}
          <button
            type="button"
            onClick={onReset}
            disabled={disabled}
            title="Rembobiner"
            className="flex items-center justify-center size-(--space-7) rounded-(--radius-xs) text-text-muted hover:text-text hover:bg-bg disabled:opacity-40 disabled:pointer-events-none transition-colors duration-(--duration-base)"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M1 4v6h6" />
              <path d="M3.51 15a9 9 0 1 0 .49-3.49" />
            </svg>
          </button>

          {/* Play / Pause */}
          <button
            type="button"
            onClick={onPlayToggle}
            disabled={disabled}
            title={isPlaying ? "Pause" : "Lecture"}
            className="flex items-center justify-center size-(--space-8) rounded-(--radius-xs) border border-(--accent-teal)/40 text-(--accent-teal) hover:bg-(--accent-teal)/10 disabled:opacity-40 disabled:pointer-events-none transition-colors duration-(--duration-base)"
          >
            {isPlaying ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5 3l14 9-14 9V3z" />
              </svg>
            )}
          </button>
        </div>

        {/* Vitesses */}
        <div className="flex items-center gap-(--space-1) shrink-0">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSpeedChange(s)}
              disabled={disabled}
              className={[
                "t-10 px-(--space-2) py-(--space-1) rounded-(--radius-xs) transition-colors duration-(--duration-base) disabled:opacity-40 disabled:pointer-events-none",
                speed === s
                  ? "bg-(--accent-teal)/15 text-(--accent-teal)"
                  : "text-text-muted hover:text-text hover:bg-surface",
              ].join(" ")}
            >
              {s}×
            </button>
          ))}
        </div>

        {/* Infos run */}
        <div className="flex items-center gap-(--space-3) ml-auto text-text-faint t-10">
          <span>{total} événements</span>
          {durationMs > 0 && <span>{formatMs(durationMs)}</span>}
        </div>
      </div>
    </div>
  );
}
