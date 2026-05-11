'use client';

import { useVoiceStore, type VoicePhase } from '@/stores/voice';
import { SPATIAL_Z_LAYERS } from '@/lib/spatial-safe/constants';

const PHASE_LABEL: Record<VoicePhase, string> = {
  idle: 'En attente',
  connecting: 'Connexion…',
  listening: 'À l’écoute',
  processing: 'Traitement',
  speaking: 'Parle',
  error: 'Erreur',
};

/**
 * Pill flottante bottom-right pour activer / visualiser la voix.
 * Cmd/Ctrl+7 toggle aussi (cf. SpatialHotkeys).
 */
export function VoicePill() {
  const voiceActive = useVoiceStore((s) => s.voiceActive);
  const phase = useVoiceStore((s) => s.phase);
  const setVoiceActive = useVoiceStore((s) => s.setVoiceActive);

  return (
    <div
      className="pointer-events-none absolute bottom-6 right-6 md:bottom-10 md:right-10"
      style={{ zIndex: SPATIAL_Z_LAYERS.hud }}
    >
      <button
        type="button"
        onClick={() => setVoiceActive(!voiceActive)}
        aria-pressed={voiceActive}
        aria-label={voiceActive ? 'Désactiver la voix' : 'Activer la voix'}
        className="pointer-events-auto inline-flex items-center gap-3 rounded-full transition-all duration-300"
        style={{
          padding: '10px 18px',
          background: voiceActive ? 'rgba(120,220,220,0.18)' : 'rgba(255,255,255,0.04)',
          border: voiceActive
            ? '1px solid rgba(120,220,220,0.5)'
            : '1px solid rgba(255,255,255,0.10)',
          backdropFilter: 'blur(20px) saturate(140%)',
          WebkitBackdropFilter: 'blur(20px) saturate(140%)',
          boxShadow: voiceActive
            ? '0 0 24px -6px rgba(120,220,220,0.45)'
            : '0 8px 24px -12px rgba(0,0,0,0.5)',
        }}
      >
        {/* Mic icon */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke={voiceActive ? 'rgba(120,220,220,0.95)' : 'rgba(255,255,255,0.6)'}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="9" y="3" width="6" height="12" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0" />
          <line x1="12" y1="18" x2="12" y2="22" />
          <line x1="8" y1="22" x2="16" y2="22" />
        </svg>

        <span
          className="text-spatial-sm tracking-[0.18em] uppercase font-light"
          style={{
            color: voiceActive ? 'rgba(120,220,220,0.95)' : 'rgba(255,255,255,0.6)',
          }}
        >
          {voiceActive ? PHASE_LABEL[phase] : 'Voix'}
        </span>

        <span
          className="text-spatial-xs tracking-[0.32em] uppercase font-light"
          style={{ color: 'rgba(255,255,255,0.35)' }}
        >
          ⌘7
        </span>
      </button>
    </div>
  );
}
