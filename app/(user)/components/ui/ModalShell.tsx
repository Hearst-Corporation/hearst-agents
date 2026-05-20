"use client";

/**
 * ModalShell — wrapper réutilisable pour les modales backdrop centrées.
 *
 * Prend en charge :
 *   - backdrop fixed inset-0 avec zIndex, scrim et blur via tokens CSS
 *   - alignement vertical (center | top via paddingTop)
 *   - focus trap + Escape + scroll lock + restore focus via useModalA11y
 *   - onClick backdrop → onClose (les enfants doivent stopper la propagation)
 *   - aria : role="dialog" aria-modal="true" transmis via labelledBy/describedBy
 *
 * Si `open === false` → return null (mount/unmount géré par le parent).
 *
 * Usage :
 *   <ModalShell open={open} onClose={onClose} labelledBy="my-modal-title">
 *     <div onClick={(e) => e.stopPropagation()}>
 *       <h2 id="my-modal-title">…</h2>
 *       …
 *     </div>
 *   </ModalShell>
 */

import { type CSSProperties, forwardRef, type ReactNode } from "react";
import { useModalA11y } from "@/app/(user)/hooks/useModalA11y";

export interface ModalShellProps {
  open: boolean;
  onClose: () => void;
  /**
   * Alignement vertical du contenu :
   *   - "center" (défaut) → items-center
   *   - "top" → items-start + paddingTop: "15vh" (ex: Commandeur)
   */
  align?: "center" | "top";
  className?: string;
  /** Style additionnel injecté sur le div backdrop (ex: background conditionnel). */
  backdropStyle?: React.CSSProperties;
  children: ReactNode;
  /** id de l'élément qui labellise la modale (aria-labelledby). */
  labelledBy?: string;
  /** id de l'élément qui décrit la modale (aria-describedby). */
  describedBy?: string;
  /**
   * Options transmises à useModalA11y. Permet aux modales qui
   * gèrent leur propre focus initial (autoFocus input) de désactiver
   * l'autoFocus du hook, ou de désactiver closeOnEscape si le composant
   * gère son propre handler Escape (ex: Commandeur).
   */
  a11yOptions?: {
    onClose?: () => void;
    closeOnEscape?: boolean;
    autoFocus?: boolean;
    lockBodyScroll?: boolean;
  };
}

/**
 * ModalShell — backdrop centré (ou aligné en haut) réutilisable.
 *
 * La ref est forwardée sur le div racine (le backdrop), ce qui permet
 * au parent de lire les coordonnées ou d'attacher des listeners externes.
 * Le focus trap de useModalA11y est attaché au div interne (dialogRef)
 * car c'est lui qui contient les éléments focusables.
 *
 * Note : les deux refs (forwardRef + useModalA11y) pointent sur des divs
 * différents par conception — backdrop (ref externe) vs dialog (ref interne).
 */
const ModalShell = forwardRef<HTMLDivElement, ModalShellProps>(
  (
    {
      open,
      onClose,
      align = "center",
      className,
      backdropStyle,
      children,
      labelledBy,
      describedBy,
      a11yOptions,
    },
    _ref,
  ) => {
    // Le hook gère : focus trap, scroll lock, restore focus, Escape.
    // On utilise ses propres options ou les defaults du hook.
    const dialogRef = useModalA11y<HTMLDivElement>(open, {
      onClose: a11yOptions?.onClose ?? onClose,
      closeOnEscape: a11yOptions?.closeOnEscape,
      autoFocus: a11yOptions?.autoFocus,
      lockBodyScroll: a11yOptions?.lockBodyScroll,
    });

    if (!open) return null;

    const isTop = align === "top";

    return (
      <div
        ref={_ref}
        className={[
          "fixed inset-0 flex justify-center",
          isTop ? "items-start" : "items-center",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        style={
          {
            zIndex: "var(--z-modal)" as unknown as number,
            background: "var(--overlay-scrim)",
            backdropFilter: "var(--blur-lg)",
            WebkitBackdropFilter: "var(--blur-lg)",
            ...(isTop ? { paddingTop: "15vh" } : {}),
            // Overrides explicites (ex: background conditionnel lors de loading).
            ...backdropStyle,
          } as CSSProperties
        }
        onClick={(e) => {
          // Click sur le backdrop uniquement (pas sur les enfants).
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {/*
         * div intermédiaire qui reçoit la ref du focus trap.
         * Les aria roles/labels sont posés ici pour que les AT lisent
         * l'élément contenu, pas le backdrop.
         * Les enfants doivent appeler e.stopPropagation() sur onClick
         * pour ne pas déclencher onClose via le backdrop.
         */}
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          {...(labelledBy ? { "aria-labelledby": labelledBy } : {})}
          {...(describedBy ? { "aria-describedby": describedBy } : {})}
        >
          {children}
        </div>
      </div>
    );
  },
);

ModalShell.displayName = "ModalShell";

export { ModalShell };
