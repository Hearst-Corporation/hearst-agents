'use client';

import { useRouter } from 'next/navigation';
import { useStageStore } from '@/stores/stage';
import { useRuntimeStore } from '@/stores/runtime';
import { SPATIAL_Z_LAYERS } from '@/lib/spatial/constants';

const MODE_LABEL: Record<string, string> = {
  cockpit: 'Cockpit',
  chat: 'Conversation',
  asset: 'Asset',
  asset_compare: 'Comparaison assets',
  mission: 'Mission',
  browser: 'Browser',
  meeting: 'Meeting',
  kg: 'Knowledge Graph',
  voice: 'Voix',
  simulation: 'Simulation',
  artifact: 'Artifact',
  signal: 'Signal',
};

/**
 * Mini breadcrumb top-left si le Stage de la shell n'est pas en `cockpit`.
 * Indique à l'user qu'un Stage classique est actif côté `/` et offre un
 * bouton "retour" pour y revenir explicitement.
 */
export function StageBreadcrumb() {
  const router = useRouter();
  const current = useStageStore((s) => s.current);
  const currentPlan = useRuntimeStore((s) => s.currentPlan);

  if (current.mode === 'cockpit') return null;

  const label = MODE_LABEL[current.mode] ?? current.mode;
  const subtitle =
    current.mode === 'mission' && currentPlan?.intent
      ? currentPlan.intent.slice(0, 48)
      : current.mode === 'asset' && 'assetId' in current
        ? current.assetId
        : null;

  return (
    <div
      className="pointer-events-none absolute top-6 left-6 md:top-10 md:left-10"
      style={{ zIndex: SPATIAL_Z_LAYERS.hud }}
    >
      <button
        type="button"
        onClick={() => router.push('/')}
        className="pointer-events-auto inline-flex items-center gap-3 rounded-full transition-colors duration-300 hover:bg-white/10"
        style={{
          padding: '8px 14px',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.10)',
          backdropFilter: 'blur(18px) saturate(140%)',
          WebkitBackdropFilter: 'blur(18px) saturate(140%)',
        }}
        title="Retour à la shell classique"
      >
        <span
          className="text-spatial-xs uppercase tracking-[0.22em] font-light"
          style={{ color: 'rgba(255,255,255,0.55)' }}
        >
          Mode actif
        </span>
        <span
          className="text-spatial-sm font-light tracking-wide"
          style={{ color: 'rgba(255,255,255,0.92)' }}
        >
          {label}
          {subtitle && <span className="text-white/45"> · {subtitle}</span>}
        </span>
        <span className="text-spatial-sm text-white/45">↗</span>
      </button>
    </div>
  );
}
