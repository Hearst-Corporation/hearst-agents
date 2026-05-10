"use client";

import { useEffect, useRef, useState } from "react";

/**
 * State de base du composer : valeur, focus, ref textarea, listeners
 * (`chat:set-input` custom event), focus auto au mount.
 */
export function useChatComposer() {
  const [input, setInput] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Pill étendue dès qu'il y a du focus ou du texte
  const isExpanded = inputFocused || input.length > 0;

  // Focus auto au mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Listener pour injection externe (Commandeur, slash commands, etc.)
  useEffect(() => {
    function onSetInput(e: Event) {
      const value = (e as CustomEvent<{ value: string }>).detail?.value;
      if (typeof value === "string") {
        setInput(value);
        inputRef.current?.focus();
      }
    }
    window.addEventListener("chat:set-input", onSetInput);
    return () => window.removeEventListener("chat:set-input", onSetInput);
  }, []);

  return {
    input,
    setInput,
    inputFocused,
    setInputFocused,
    inputRef,
    isExpanded,
  };
}
