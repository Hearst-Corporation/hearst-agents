/**
 * Schémas zod canoniques pour les routes `/api/v2/jobs/*`.
 *
 * Centralise la validation des payloads des jobs IA payants (image-gen,
 * audio-gen, code-exec, document-parse) afin que les routes API et les
 * éventuels callers internes partagent une seule source de vérité.
 *
 * Les schémas sont alignés sur les inputs des workers correspondants
 * (`lib/jobs/types.ts`) — toute évolution doit être propagée des deux
 * côtés.
 */

import { z } from "zod";
import { isUrlShapeAllowed } from "@/lib/security/ssrf-guard";

// ── image-gen (FAL flux-pro) ─────────────────────────────

export const imageGenSchema = z.object({
  prompt: z.string().min(1).max(2000),
  threadId: z.string().optional(),
  count: z.number().int().min(1).max(4).optional(),
  size: z.enum(["256x256", "512x512", "1024x1024", "1536x1024", "1024x1536"]).optional(),
  /** Mode d'enrichissement automatique. Default = editorial. */
  style: z.enum(["editorial", "cinematic", "flat-illustration", "portrait", "product"]).optional(),
});

// ── audio-gen (ElevenLabs TTS) ───────────────────────────

export const audioGenSchema = z.object({
  text: z.string().min(1).max(5000),
  voiceId: z.string().optional(),
  modelId: z.string().optional(),
  threadId: z.string().optional(),
  /** Tone de la persona pour mapping voix automatique. */
  tone: z
    .enum(["formal", "direct", "analytical", "casual", "warm-professional", "creative", "default"])
    .optional(),
  /** ID persona (alternatif à tone — non utilisé pour résolution serveur ici). */
  personaId: z.string().optional(),
});

// ── code-exec (E2B sandbox) ──────────────────────────────

export const codeExecSchema = z.object({
  code: z.string().min(1).max(50_000),
  runtime: z.enum(["python", "node"]).optional(),
  timeoutMs: z.number().int().min(1_000).max(120_000).optional(),
  threadId: z.string().optional(),
});

// ── document-parse (LlamaCloud) ──────────────────────────

export const documentParseSchema = z.object({
  fileUrl: z
    .string()
    .url()
    .refine(
      (u) => isUrlShapeAllowed(u, { allowedSchemes: ["https:"] }),
      "URL non autorisée (doit être https et pointer vers un hôte public)",
    ),
  mimeType: z.string().optional(),
  fileName: z.string().optional(),
  threadId: z.string().optional(),
});
