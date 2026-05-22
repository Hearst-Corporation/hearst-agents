"use client";

/**
 * OnboardingTour — overlay 3 slides montré au premier login (vague 9, action #5).
 *
 * Trigger : flag localStorage `hearst.onboarded` absent. Une fois fini ou
 * skippé, on persiste `hearst.onboarded = "1"` pour ne plus l'afficher.
 *
 * Pourquoi localStorage et pas DB : MVP, single-device acceptable. Phase 2 :
 * persister dans `users.onboarded_at` côté Supabase pour cross-device.
 *
 * 3 slides volontairement minimalistes — l'objectif est de poser la promesse
 * du produit en 30s, pas de tout expliquer. Tokens design system uniquement.
 */

import { useCallback, useEffect, useState } from "react";
import { Action } from "./ui";

const STORAGE_KEY = "hearst.onboarded";

interface Slide {
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
}

const SLIDES: Slide[] = [
  {
    eyebrow: "01 — Bienvenue",
    title: "Hearst voit ce que tu vois.",
    body: "Tes emails, ton agenda, ton pipeline, tes PRs. Hearst observe ton quotidien et te livre un brief éditorial chaque matin — un PDF qui se lit, pas un dashboard de plus.",
    cta: "Suivant",
  },
  {
    eyebrow: "02 — Connexions",
    title: "Branche tes outils en un clic.",
    body: "Gmail, Slack, GitHub, Linear, HubSpot, Stripe… Plus d'apps connectées, plus de signal. Tu peux commencer avec une seule, et brancher le reste plus tard.",
    cta: "Suivant",
  },
  {
    eyebrow: "03 — Démarrer",
    title: "Lance ta première demande.",
    body: "Tape une intention dans le Commandeur (⌘K), ou demande à Hearst de générer ton brief du jour. Lance ta première demande depuis là.",
    cta: "Démarrer",
  },
];

interface OnboardingTourProps {
  /** Override pour les tests : force l'affichage indépendamment de localStorage. */
  forceOpen?: boolean;
  /** Callback appelé quand le tour se ferme (skip ou fin). */
  onClose?: () => void;
}

export function OnboardingTour({ forceOpen, onClose }: OnboardingTourProps = {}) {
  // Ne jamais lire localStorage dans l'initializer : SSR et premier rendu client
  // doivent matcher (open=false), sinon hydration mismatch. Après mount,
  // useEffect ouvre le tour si le flag n'est pas persisté.
  const [open, setOpen] = useState(() => Boolean(forceOpen));
  const [step, setStep] = useState(0);

  useEffect(() => {
    queueMicrotask(() => {
      if (forceOpen) {
        setOpen(true);
        return;
      }
      try {
        setOpen(!window.localStorage.getItem(STORAGE_KEY));
      } catch {
        setOpen(false);
      }
    });
  }, [forceOpen]);

  const close = useCallback(() => {
    setOpen(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    onClose?.();
  }, [onClose]);

  const handleNext = useCallback(() => {
    if (step >= SLIDES.length - 1) {
      close();
    } else {
      setStep(step + 1);
    }
  }, [step, close]);

  // Hotkey Escape pour skip
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "Enter" || e.key === "ArrowRight") handleNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, close, handleNext]);

  if (!open) return null;

  const slide = SLIDES[step];

  return (
    <div
      role="dialog"
      aria-label="Bienvenue dans Hearst OS"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: "var(--z-overlay)" as unknown as number,
        background: "var(--overlay-scrim)",
        backdropFilter: "var(--blur-sm)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-8)",
      }}
    >
      <div
        className="flex flex-col w-full max-w-(--width-2xl)"
        style={{
          background: "var(--bg-elev)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-12)",
        }}
      >
        <div
          className="flex items-baseline justify-between"
          style={{ marginBottom: "var(--space-8)" }}
        >
          <span className="t-9 font-medium" style={{ color: "var(--gold)" }}>
            {slide.eyebrow}
          </span>
          <Action
            variant="ghost"
            tone="neutral"
            size="sm"
            onClick={close}
            aria-label="Passer l'onboarding"
          >
            Passer
          </Action>
        </div>

        <h2 className="t-28 font-medium text-text-l1 leading-tight mb-5">{slide.title}</h2>

        <p className="t-15 font-light text-text-l2 leading-relaxed mb-10">{slide.body}</p>

        <div className="flex items-center justify-between">
          <div className="flex items-center" style={{ gap: "var(--space-2)" }}>
            {SLIDES.map((_, i) => (
              <span
                key={i}
                style={{
                  width: i === step ? "var(--space-6)" : "var(--space-2)",
                  height: "var(--space-2)",
                  borderRadius: "var(--radius-pill)",
                  background: i === step ? "var(--accent-teal)" : "var(--border-default)",
                  transition: "width 200ms ease",
                }}
              />
            ))}
          </div>

          <Action
            variant="primary"
            tone="brand"
            size="sm"
            onClick={handleNext}
            testId="onboarding-next"
          >
            {slide.cta}
          </Action>
        </div>
      </div>
    </div>
  );
}
