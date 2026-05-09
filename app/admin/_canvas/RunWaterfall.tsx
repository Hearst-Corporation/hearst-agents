/** TODO stub — voir docs/AGENT-DRIVEN-DEV.md
 *
 * Waterfall horizontal des événements d'un run + contrôles replay.
 * Stub composant placeholder.
 * À implémenter : timeline scrubber, play/pause, vitesses, ticks par event.
 */

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

export default function RunWaterfall({
  events,
  isPlaying: _isPlaying,
  progress: _progress,
  speed: _speed,
  onPlayToggle: _onPlayToggle,
  onSpeedChange: _onSpeedChange,
  onReset: _onReset,
  onSeek: _onSeek,
  disabled: _disabled,
}: Props) {
  return (
    <div
      data-stub="RunWaterfall"
      className="shrink-0 border-t border-line bg-surface px-(--space-6) py-(--space-3) t-11 font-mono uppercase tracking-(--tracking-stretch) text-text-faint"
    >
      Waterfall (stub) · {events.length} événements
    </div>
  );
}
