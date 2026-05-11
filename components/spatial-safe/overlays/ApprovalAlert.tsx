'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useRuntimeStore } from '@/stores/runtime';
import { SPATIAL_Z_LAYERS } from '@/lib/spatial-safe/constants';

/**
 * Alerte HITL — affichée top-right quand un step de plan attend approbation.
 * Bouton "Approuver" appelle `approveStep(planId, stepId)`.
 *
 * Pulse halo cyan pour matcher la mood Spline 'approval'.
 */
export function ApprovalAlert() {
  const currentPlan = useRuntimeStore((s) => s.currentPlan);
  const coreState = useRuntimeStore((s) => s.coreState);
  const approveStep = useRuntimeStore((s) => s.approveStep);

  const awaitingStep = currentPlan?.steps.find((s) => s.status === 'awaiting_approval');
  const show = coreState === 'awaiting_approval' && !!awaitingStep && !!currentPlan;

  return (
    <div
      className="pointer-events-none absolute top-6 right-6 md:top-10 md:right-10"
      style={{ zIndex: SPATIAL_Z_LAYERS.overlay }}
    >
      <AnimatePresence>
        {show && currentPlan && awaitingStep && (
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.96, filter: 'blur(8px)' }}
            animate={{
              opacity: 1, y: 0, scale: 1, filter: 'blur(0px)',
              transition: { duration: 1.0, ease: [0.16, 1, 0.3, 1] },
            }}
            exit={{
              opacity: 0, y: -8, scale: 0.97, filter: 'blur(6px)',
              transition: { duration: 0.4 },
            }}
            className="pointer-events-auto w-[min(360px,80vw)]"
          >
            <div
              className="relative overflow-hidden rounded-[28px] p-6"
              style={{
                background: 'rgba(255,255,255,0.06)',
                backdropFilter: 'blur(28px) saturate(140%)',
                WebkitBackdropFilter: 'blur(28px) saturate(140%)',
                border: '1px solid rgba(120,220,220,0.35)',
                boxShadow:
                  'inset 0 1px 0 rgba(255,255,255,0.06), 0 0 32px -8px rgba(120,220,220,0.4), 0 12px 32px -16px rgba(0,0,0,0.5)',
              }}
            >
              <div
                aria-hidden
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    'radial-gradient(circle at 80% 20%, rgba(120,220,220,0.18) 0%, transparent 60%)',
                  animation: 'spatial-mission-pulse 2.4s ease-in-out infinite',
                }}
              />

              <div className="relative">
                <div
                  className="mb-2 text-spatial-xs font-semibold uppercase tracking-[0.22em]"
                  style={{ color: 'rgba(120,220,220,0.95)' }}
                >
                  Validation requise
                </div>

                <div className="text-spatial-lg font-light tracking-tight text-white/95 line-clamp-2">
                  {awaitingStep.label}
                </div>

                {awaitingStep.approvalPreview && (
                  <p className="mt-3 text-spatial-base font-light leading-snug text-white/65 line-clamp-4">
                    {awaitingStep.approvalPreview}
                  </p>
                )}

                <div className="mt-5 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => void approveStep(currentPlan.id, awaitingStep.id)}
                    className="px-5 py-2 rounded-full text-spatial-md tracking-[0.18em] uppercase font-light"
                    style={{
                      backgroundColor: 'rgba(120,220,220,0.92)',
                      color: '#0a1414',
                      boxShadow: '0 6px 18px -6px rgba(120,220,220,0.55)',
                    }}
                  >
                    Approuver
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
