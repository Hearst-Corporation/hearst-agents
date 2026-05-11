'use client';

/**
 * useSplineToolBridge — déclenche des anims Spline contextuelles quand un
 * tool call démarre (gmail/slack/fal_ai/composio).
 *
 * Lit `useRuntimeStore.events` et observe le dernier event. Quand on voit
 * un `tool_call_started`, on map le providerId vers une key d'event Spline
 * (G..J) et on `keyDown` sur l'objet Robot.
 *
 * No-op si la scène ne définit pas ces States — l'app reste fonctionnelle.
 */

import { useEffect, useRef } from 'react';
import { useRuntimeStore } from '@/stores/runtime';
import type { UseSplineApp } from './useSplineApp';

const PROVIDER_TO_SPLINE_KEY: Record<string, string> = {
  gmail: 'G',
  google_mail: 'G',
  slack: 'H',
  fal_ai: 'I',
  fal: 'I',
  composio: 'J',
};

const TOOL_EVENT_TYPES = new Set([
  'tool_call_started',
  'tool_call_start',
  'plan_step_started',
]);

export function useSplineToolBridge(spline: UseSplineApp) {
  const lastEventTsRef = useRef<number>(0);

  useEffect(() => {
    // Subscribe granularement aux events runtime — Zustand subscribeWithSelector.
    const unsub = useRuntimeStore.subscribe(
      (s) => s.events,
      (events) => {
        if (!spline.ready.current) return;
        const head = events[0]; // events est unshifted, [0] = plus récent
        if (!head) return;
        // Garde anti-replay : on n'agit qu'une fois par event timestamp
        if (head.timestamp <= lastEventTsRef.current) return;
        if (!TOOL_EVENT_TYPES.has(head.type)) return;
        lastEventTsRef.current = head.timestamp;

        const providerId =
          (head.providerId as string | undefined) ??
          (head.provider_id as string | undefined) ??
          (head.kind as string | undefined);
        const key = (providerId && PROVIDER_TO_SPLINE_KEY[providerId]) ?? 'J';
        // Met à jour la mood pour qu'un shader scene-side puisse lire le contexte
        spline.setVar('mood', `tool:${providerId ?? 'generic'}`);
        spline.emit('keyDown', 'Robot');
        // L'event Spline pour le providerId spécifique est encodé via setVariable
        // (le Mapping G/H/I/J n'est pas envoyé sur 'Robot' directement — Spline
        // ne supporte qu'une key par event 'keyDown'. La scène doit lire `mood`
        // pour décider de la sub-animation.)
        spline.setVar('tool_key', key);
      },
    );
    return () => {
      unsub();
    };
  }, [spline]);
}
