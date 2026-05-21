"use client";

/**
 * FilterTabs — onglets / filtres horizontaux (pages standalone mock).
 * Tokens uniquement — remplace bg-white/10 + text-white/40.
 *
 * Contrôlable via `value` + `onValueChange` (ou `onChange` alias).
 * Si aucun handler n'est fourni, le composant reste non-interactif
 * (mode affichage seul, rétrocompatible).
 */

interface FilterTabsProps {
  tabs: readonly string[];
  active: string;
  "aria-label"?: string;
  /** Sans marge basse — quand les tabs sont dans une barre d'outils. */
  inline?: boolean;
  /** Appelé avec le label de l'onglet cliqué. */
  onValueChange?: (value: string) => void;
  /** Alias de `onValueChange` pour rétrocompatibilité. */
  onChange?: (value: string) => void;
}

export function FilterTabs({
  tabs,
  active,
  "aria-label": ariaLabel,
  inline,
  onValueChange,
  onChange,
}: FilterTabsProps) {
  const handleChange = onValueChange ?? onChange;

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex items-center flex-wrap"
      style={{
        gap: "var(--space-1)",
        marginBottom: inline ? undefined : "var(--space-6)",
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab === active;
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={handleChange ? () => handleChange(tab) : undefined}
            className={`t-13 font-medium rounded-lg transition-colors ${
              isActive
                ? "bg-(--surface-2) text-text"
                : "text-text-faint hover:text-text-soft hover:bg-(--surface-1)"
            }`}
            style={{ padding: "var(--space-1-5) var(--space-4)" }}
          >
            {tab}
          </button>
        );
      })}
    </div>
  );
}
