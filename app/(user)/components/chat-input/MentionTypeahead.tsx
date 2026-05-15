"use client";

import type { RefObject } from "react";
import type { ServiceDefinition } from "@/lib/integrations/types";

interface MentionTypeaheadProps {
  typeaheadRef: RefObject<HTMLDivElement | null>;
  matchingServices: ServiceDefinition[];
  typeaheadQuery: string;
  onSelect: (service: ServiceDefinition) => void;
}

/**
 * Dropdown @mention au-dessus du composer. Liste les services connectés
 * qui matchent la query. Empty state textuel si rien ne matche.
 */
export function MentionTypeahead({
  typeaheadRef,
  matchingServices,
  typeaheadQuery,
  onSelect,
}: MentionTypeaheadProps) {
  return (
    <div
      ref={typeaheadRef}
      className="absolute bottom-full mb-4 w-full rounded-(--radius-2xl) border border-(--border-shell) overflow-hidden"
      style={{
        zIndex: "var(--z-dropdown)" as unknown as number,
        background: "var(--bg-elev)",
        boxShadow: "var(--shadow-card-hover)",
      }}
    >
      {matchingServices.length === 0 ? (
        <div className="p-4 t-11 font-light text-text-ghost">
          {typeaheadQuery ? (
            <>No source found&nbsp;: {typeaheadQuery}</>
          ) : (
            <>Tapez @ pour mentionner une source</>
          )}
        </div>
      ) : (
        <div className="py-2">
          {matchingServices.map((service) => (
            <button
              key={service.id}
              onClick={() => onSelect(service)}
              className="w-full flex items-center gap-4 px-4 py-3 text-left border-b border-(--line) transition-colors duration-(--duration-emphasis) group hover:bg-surface-1"
            >
              <span className="t-18 text-text-faint group-hover:text-(--accent-teal) transition-colors">
                {service.icon}
              </span>
              <div className="flex-1">
                <p className="t-13 font-medium tracking-wide text-text-soft group-hover:text-text transition-colors">
                  @{service.id}
                </p>
                <p className="t-10 text-text-ghost mt-0.5">{service.name}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
