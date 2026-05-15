"use client";

/**
 * useSplineApp — capture l'`Application` Spline au mount + expose helpers
 * type-safe pour piloter scene depuis le runtime LLM/voice.
 *
 * Pourquoi un hook + refs : l'Application Spline est instanciée client-only
 * au moment où la scène est chargée. On la stocke dans une ref pour pouvoir
 * la consommer depuis d'autres hooks (voice/state/tool bridges) sans
 * provoquer de re-render à chaque tick audio.
 *
 * Tous les helpers sont no-op si la scène n'est pas encore prête (`ready=false`)
 * ou si le nom de variable / d'objet n'existe pas. Spline lui-même ne throw
 * pas — on protège juste contre les erreurs JS pendant le hot-reload dev.
 */

import type { Application, SPEObject, SplineEventName } from "@splinetool/runtime";
import { useCallback, useRef } from "react";

const TARGET_OBJECTS = ["Robot", "Orb", "Halo", "Eyes"] as const;
export type SplineTargetName = (typeof TARGET_OBJECTS)[number];

export interface UseSplineApp {
  onLoad: (app: Application) => void;
  emit: (event: SplineEventName, target: string) => void;
  setVar: (name: string, value: number | string | boolean) => void;
  obj: (name: SplineTargetName) => SPEObject | undefined;
  app: React.MutableRefObject<Application | null>;
  ready: React.MutableRefObject<boolean>;
}

export function useSplineApp(): UseSplineApp {
  const appRef = useRef<Application | null>(null);
  const objectsRef = useRef<Map<SplineTargetName, SPEObject>>(new Map());
  const readyRef = useRef(false);
  const warnedMissingObjectsRef = useRef(false);

  const onLoad = useCallback((app: Application) => {
    appRef.current = app;
    objectsRef.current.clear();
    let foundAny = false;
    for (const name of TARGET_OBJECTS) {
      const o = app.findObjectByName(name);
      if (o) {
        objectsRef.current.set(name, o);
        foundAny = true;
      }
    }
    if (!foundAny && !warnedMissingObjectsRef.current) {
      warnedMissingObjectsRef.current = true;
      console.warn(
        "[spatial/useSplineApp] aucun des objets Spline attendus introuvable " +
          `(${TARGET_OBJECTS.join(", ")}). Les bridges runtime tomberont en no-op silencieux. ` +
          "Demander au designer Spline de nommer les objets canoniques.",
      );
    }
    readyRef.current = true;
  }, []);

  const emit = useCallback((event: SplineEventName, target: string) => {
    const app = appRef.current;
    if (!app) return;
    try {
      app.emitEvent(event, target);
    } catch (err) {
      // emitEvent peut throw si l'event/target est inconnu de la scène.
      // On swallow : la scène n'expose juste pas cet event, l'app reste viable.
      if (process.env.NODE_ENV !== "production") {
        console.debug("[spatial/useSplineApp] emitEvent no-op:", event, target, err);
      }
    }
  }, []);

  const setVar = useCallback((name: string, value: number | string | boolean) => {
    const app = appRef.current;
    if (!app) return;
    try {
      app.setVariable(name, value);
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.debug("[spatial/useSplineApp] setVariable no-op:", name, err);
      }
    }
  }, []);

  const obj = useCallback((name: SplineTargetName) => objectsRef.current.get(name), []);

  return { onLoad, emit, setVar, obj, app: appRef, ready: readyRef };
}
