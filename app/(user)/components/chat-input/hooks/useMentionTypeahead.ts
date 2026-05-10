"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ServiceDefinition } from "@/lib/integrations/types";

const MAX_MATCHING_SERVICES = 5;

interface UseMentionTypeaheadParams {
  input: string;
  setInput: (value: string) => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  connectedServices: ServiceDefinition[];
  onProviderMention?: (providerId: string) => void;
}

/**
 * Logique du typeahead @mention dans le composer.
 * Détecte le dernier `@<query>` (sans espace), filtre les services connectés,
 * gère insertion + close on outside click + reset après input change.
 */
export function useMentionTypeahead({
  input,
  setInput,
  inputRef,
  connectedServices,
  onProviderMention,
}: UseMentionTypeaheadParams) {
  const typeaheadRef = useRef<HTMLDivElement>(null);
  const [hideTypeahead, setHideTypeahead] = useState(false);

  const lastAtIndex = input.lastIndexOf("@");
  const afterAt = lastAtIndex !== -1 ? input.slice(lastAtIndex + 1) : "";
  const hasSpace = afterAt.includes(" ");
  const typeaheadQuery = !hasSpace ? afterAt.toLowerCase() : "";
  const showTypeahead = lastAtIndex !== -1 && !hasSpace && !hideTypeahead;

  // Close typeahead when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        typeaheadRef.current &&
        !typeaheadRef.current.contains(e.target as Node)
      ) {
        setHideTypeahead(true);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset hide when input changes (allows reopening after @)
  useEffect(() => {
    if (hideTypeahead && input.includes("@")) {
      const timeout = setTimeout(() => setHideTypeahead(false), 0);
      return () => clearTimeout(timeout);
    }
  }, [input, hideTypeahead]);

  const matchingServices = useMemo(
    () =>
      connectedServices
        .filter(
          (service) =>
            service.id.toLowerCase().includes(typeaheadQuery) ||
            service.name.toLowerCase().includes(typeaheadQuery),
        )
        .slice(0, MAX_MATCHING_SERVICES),
    [connectedServices, typeaheadQuery],
  );

  const selectService = useCallback(
    (service: ServiceDefinition) => {
      const beforeAt = input.slice(0, lastAtIndex);
      const afterQuery = input.slice(
        lastAtIndex + 1 + typeaheadQuery.length,
      );
      const newInput = `${beforeAt}@${service.id} ${afterQuery}`;
      setInput(newInput);
      setHideTypeahead(true);
      onProviderMention?.(service.id);
      inputRef.current?.focus();
    },
    [
      input,
      lastAtIndex,
      typeaheadQuery,
      setInput,
      onProviderMention,
      inputRef,
    ],
  );

  /**
   * Quick-mention depuis la rangée d'icônes sous l'input. Insère
   * `@<service.id>` à la fin du texte courant (avec espace de séparation
   * si nécessaire), focus le textarea. Si l'user était en train de taper
   * un `@<query>`, on remplace cette query par le service complet.
   */
  const insertMentionFromIcon = useCallback(
    (service: ServiceDefinition) => {
      if (lastAtIndex !== -1 && !hasSpace) {
        selectService(service);
        return;
      }
      const trail = input.length === 0 || input.endsWith(" ") ? "" : " ";
      setInput(`${input}${trail}@${service.id} `);
      onProviderMention?.(service.id);
      inputRef.current?.focus();
    },
    [
      lastAtIndex,
      hasSpace,
      input,
      selectService,
      setInput,
      onProviderMention,
      inputRef,
    ],
  );

  return {
    typeaheadRef,
    showTypeahead,
    typeaheadQuery,
    matchingServices,
    selectService,
    insertMentionFromIcon,
    setHideTypeahead,
  };
}
