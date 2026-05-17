"use client";

import { useCallback, useState } from "react";
import { toast } from "@/app/hooks/use-toast";
import type { InlineGenStatus } from "../types";
import { extractCodeBlock } from "../utils/extractCodeBlock";

const SUCCESS_RESET_MS = 4000;
const ERROR_RESET_MS = 5000;

interface UseInlineGenParams {
  input: string;
  setInput: (value: string) => void;
}

/**
 * Hook qui regroupe les 3 générations inline déclenchées depuis le composer :
 * image (`/api/v2/jobs/image-gen`), audio (`/api/v2/jobs/audio-gen`),
 * code (`/api/v2/jobs/code-exec`).
 *
 * Chaque action a son propre status (`idle | pending | error`) et son message
 * éphémère. Pas d'altération des invariants chat (pas d'orchestrate).
 */
export function useInlineGen({ input, setInput }: UseInlineGenParams) {
  const [imageGenStatus, setImageGenStatus] = useState<InlineGenStatus>("idle");
  const [imageGenMessage, setImageGenMessage] = useState<string | null>(null);

  const [audioGenStatus, setAudioGenStatus] = useState<InlineGenStatus>("idle");
  const [audioGenMessage, setAudioGenMessage] = useState<string | null>(null);

  const [codeExecStatus, setCodeExecStatus] = useState<InlineGenStatus>("idle");
  const [codeExecMessage, setCodeExecMessage] = useState<string | null>(null);

  const handleImageGen = useCallback(async () => {
    const prompt = input.trim();
    if (!prompt || imageGenStatus === "pending") return;
    setImageGenStatus("pending");
    setImageGenMessage("Generating image…");
    try {
      const res = await fetch("/api/v2/jobs/image-gen", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ prompt }),
      });
      const data = (await res.json()) as {
        jobId?: string;
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        const reason = data.message ?? data.error ?? "Image generation error";
        throw new Error(reason);
      }
      // T-C17 : toast plus fiable que le message éphémère in-composer (qui
      // disparaît silencieusement si l'utilisateur a scrollé / change de
      // Stage). Le toast reste visible quel que soit le contexte visuel.
      setImageGenStatus("idle");
      setImageGenMessage(null);
      setInput("");
      toast.success("Image en file d'attente", "Elle apparaîtra dans tes assets.");
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Image generation error";
      setImageGenStatus("error");
      setImageGenMessage(reason);
      setTimeout(() => {
        setImageGenStatus("idle");
        setImageGenMessage(null);
      }, ERROR_RESET_MS);
    }
  }, [input, imageGenStatus, setInput]);

  const handleAudioGen = useCallback(async () => {
    const text = input.trim();
    if (!text || audioGenStatus === "pending") return;
    setAudioGenStatus("pending");
    setAudioGenMessage("Synthesizing audio…");
    try {
      const res = await fetch("/api/v2/jobs/audio-gen", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text }),
      });
      const data = (await res.json()) as {
        jobId?: string;
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        const reason = data.message ?? data.error ?? "Audio synthesis error";
        throw new Error(reason);
      }
      setAudioGenStatus("idle");
      setAudioGenMessage("Audio queued — it will appear in your assets.");
      setInput("");
      setTimeout(() => setAudioGenMessage(null), SUCCESS_RESET_MS);
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Audio synthesis error";
      setAudioGenStatus("error");
      setAudioGenMessage(reason);
      setTimeout(() => {
        setAudioGenStatus("idle");
        setAudioGenMessage(null);
      }, ERROR_RESET_MS);
    }
  }, [input, audioGenStatus, setInput]);

  const handleCodeExec = useCallback(async () => {
    if (codeExecStatus === "pending") return;
    const extracted = extractCodeBlock(input);
    if (!extracted?.code) return;
    setCodeExecStatus("pending");
    setCodeExecMessage("Running sandbox…");
    try {
      const res = await fetch("/api/v2/jobs/code-exec", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          code: extracted.code,
          runtime: extracted.runtime,
        }),
      });
      const data = (await res.json()) as {
        jobId?: string;
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        const reason = data.message ?? data.error ?? "Code execution error";
        throw new Error(reason);
      }
      setCodeExecStatus("idle");
      setCodeExecMessage("Execution started — result will appear in your assets.");
      setInput("");
      setTimeout(() => setCodeExecMessage(null), SUCCESS_RESET_MS);
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Code execution error";
      setCodeExecStatus("error");
      setCodeExecMessage(reason);
      setTimeout(() => {
        setCodeExecStatus("idle");
        setCodeExecMessage(null);
      }, ERROR_RESET_MS);
    }
  }, [input, codeExecStatus, setInput]);

  return {
    imageGenStatus,
    imageGenMessage,
    audioGenStatus,
    audioGenMessage,
    codeExecStatus,
    codeExecMessage,
    handleImageGen,
    handleAudioGen,
    handleCodeExec,
  };
}
