"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useStageStore } from "@/stores/stage";
import { useVoiceStore } from "@/stores/voice";

/**
 * Hotkeys actifs sur /spatial :
 *  - Cmd/Ctrl + K → ouvre le Commandeur (sur la home /, qui héberge le composant)
 *  - Cmd/Ctrl + 7 → toggle voiceActive (mode cinéma vocal)
 *  - Cmd/Ctrl + Backspace → router.back()
 *
 * Pas de monter de composant — juste un effet global.
 */
export function SpatialHotkeys() {
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;

      if (e.key === "k" || e.key === "K") {
        e.preventDefault();
        useStageStore.getState().setCommandeurOpen(true, { prefilledQuery: "" });
        router.push("/");
        return;
      }

      if (e.key === "7") {
        e.preventDefault();
        const cur = useVoiceStore.getState().voiceActive;
        useVoiceStore.getState().setVoiceActive(!cur);
        return;
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return null;
}
