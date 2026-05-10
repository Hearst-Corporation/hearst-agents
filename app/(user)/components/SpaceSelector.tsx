"use client";

/**
 * SpaceSelector — sélecteur de "Space" multi-projets (foundation Q3-C).
 *
 * Affiche un dot coloré par space (perso / side / venture par défaut) et
 * laisse l'utilisateur basculer d'un silo à l'autre. Voix "silent luxury" :
 *   - dots de var(--size-dot) (6px)
 *   - gap var(--space-1) (4px)
 *   - active = scale 1.2 + outline 1px de la couleur du space
 *   - inactive = opacity 0.5, hover bring back à 1
 *   - transition 200ms var(--ease-standard)
 *
 * IMPORTANT — Phase 1 / Foundation only :
 *   Le selector écrit dans `useActiveSpace()` mais aucune query downstream
 *   n'est encore filtrée. Pas d'avertissement bruyant côté UI : la promesse
 *   de filtrage arrivera avec la Phase 3 (cf. `docs/features/spaces.md`).
 *   Tooltip = label simple, pas de "preview" verbeux.
 */

import { useState } from "react";
import { useActiveSpace, type SpaceConfig } from "@/stores/active-space";

export function SpaceSelector() {
  const spaces = useActiveSpace((s) => s.spaces);
  const activeSpaceId = useActiveSpace((s) => s.activeSpaceId);
  const setActiveSpace = useActiveSpace((s) => s.setActiveSpace);

  return (
    <div
      className="flex items-center"
      style={{ gap: "var(--space-1)" }}
      role="radiogroup"
      aria-label="Sélection de l'espace de travail"
      data-testid="space-selector"
    >
      {spaces.map((space) => (
        <SpaceDot
          key={space.id}
          space={space}
          isActive={space.id === activeSpaceId}
          onSelect={() => setActiveSpace(space.id)}
        />
      ))}
    </div>
  );
}

interface SpaceDotProps {
  space: SpaceConfig;
  isActive: boolean;
  onSelect: () => void;
}

/**
 * Dot atomique — bouton circulaire 6px, transition scale + outline. On gère
 * la mini-animation "bump" au clic via un flag `bumping` qui retombe après
 * 200ms (durée alignée sur var(--duration-standard) côté CSS).
 */
function SpaceDot({ space, isActive, onSelect }: SpaceDotProps) {
  const [bumping, setBumping] = useState(false);

  const handleClick = () => {
    if (!isActive) {
      // Bump uniquement quand on switch vers un autre space — clic sur le dot
      // déjà actif = no-op silencieux pour ne pas créer de "blink" gratuit.
      setBumping(true);
      setTimeout(() => setBumping(false), 200);
    }
    onSelect();
  };

  // Active : scale 1.2 stable + outline subtle. Bump : scale 1.3 transient
  // pour signaler le switch, retombe à 1.2 (active) ou 1 (inactive).
  let scale = 1;
  if (isActive) scale = 1.2;
  if (bumping) scale = 1.3;

  return (
    <button
      type="button"
      role="radio"
      aria-checked={isActive}
      aria-label={`Espace ${space.label}`}
      title={space.label}
      onClick={handleClick}
      className="rounded-pill shrink-0 cursor-pointer"
      data-space-id={space.id}
      data-active={isActive ? "true" : "false"}
      style={{
        width: "var(--size-dot)",
        height: "var(--size-dot)",
        background: space.color,
        opacity: isActive ? 1 : 0.5,
        outline: isActive ? `1px solid ${space.color}` : "none",
        outlineOffset: "2px",
        transform: `scale(${scale})`,
        transition: `transform var(--duration-slow) var(--ease-standard), opacity var(--duration-slow) var(--ease-standard)`,
      }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.opacity = "1";
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.opacity = "0.5";
      }}
    />
  );
}
