/**
 * Extras Media tools — expose 4 workers Phase B existants comme tools agent.
 *
 * Wrappers fins autour de generateImage pattern (lib/tools/native/hearst-actions.ts) :
 *   storeAsset(placeholder) → createVariant(pending) → enqueueJob → emit stage_request → return
 *
 * - generate_audio (ElevenLabs TTS) : safe, pas de confirm
 * - parse_document (LlamaParse) : safe, pas de confirm
 * - generate_video (HeyGen/Runway) : ~$0.50/run, **confirm pattern requis** (preview)
 * - run_code (E2B sandbox) : sécurité critique, **validation syntaxe + blacklist** + confirm
 */

import { randomUUID } from "node:crypto";
import type { Tool } from "ai";
import { jsonSchema } from "ai";
import { storeAsset } from "@/lib/assets/types";
import { createVariant } from "@/lib/assets/variants";
import { formatInsufficientCreditsMessage, requireCreditsForJob } from "@/lib/credits/middleware";
import type { RunEventBus } from "@/lib/events/bus";
import { enqueueJob } from "@/lib/jobs/queue";
import type {
  AudioGenInput,
  CodeExecInput,
  DocumentParseInput,
  JobKind,
  VideoGenInput,
} from "@/lib/jobs/types";
import { ensureContentAllowed } from "@/lib/moderation/openai";
import type { TenantScope } from "@/lib/multi-tenant/types";

/**
 * Garde-fou crédits commun aux 4 tools média.
 *
 * Skip si userId absent (chemin "anonymous" en dev). Sinon, tente une
 * réservation atomique avant l'enqueue : refuse net si solde insuffisant
 * pour éviter d'enqueue un job qui ne peut être payé (cf. audit P0-4).
 *
 * Retourne `null` si OK (continue), un message user-facing sinon.
 */
async function ensureCreditsOrMessage(args: {
  scope: TenantScope;
  jobKind: JobKind;
  estimatedCostUsd: number;
  jobId: string;
}): Promise<string | null> {
  if (!args.scope.userId) return null;
  const guard = await requireCreditsForJob({
    userId: args.scope.userId,
    tenantId: args.scope.tenantId,
    jobKind: args.jobKind,
    estimatedCostUsd: args.estimatedCostUsd,
    jobId: args.jobId,
  });
  if (!guard.allowed) {
    return formatInsufficientCreditsMessage(guard, args.jobKind);
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AiToolMap = Record<string, Tool<any, any>>;

// ── generate_audio ──────────────────────────────────────────────

interface GenerateAudioArgs {
  text: string;
  voiceId?: string;
  tone?: string;
}

// ── parse_document ──────────────────────────────────────────────

interface ParseDocumentArgs {
  fileUrl: string;
  fileName: string;
  mimeType: string;
}

// ── generate_video ──────────────────────────────────────────────

interface GenerateVideoArgs {
  prompt: string;
  scriptText?: string;
  provider?: "heygen" | "runway";
  durationSeconds?: number;
  avatarId?: string;
  voiceId?: string;
  /** Pattern preview/confirm : `_preview: true` (défaut) retourne un draft. */
  _preview?: boolean;
}

// ── run_code ────────────────────────────────────────────────────

interface RunCodeArgs {
  code: string;
  runtime: "python" | "node";
  /** Pattern preview/confirm : `_preview: true` (défaut) retourne un draft. */
  _preview?: boolean;
}

// Blacklist de patterns dangereux pour run_code (Python).
//
// ATTENTION : Cette blacklist est une DEFENSE SECONDAIRE uniquement.
// La DEFENSE PRIMAIRE est E2B Sandbox.create({ networkAccess: false, env: {} })
// dans lib/capabilities/providers/e2b.ts.
//
// Cette blacklist ne doit PAS être considérée sûre seule :
// - Elle est contournable (base64, imports dynamiques, etc.)
// - Elle ne couvre pas Node.js (syntaxe parse uniquement pour JS)
//
// Ne jamais exposer ce tool agent directement en prod sans le sandbox E2B.
const PYTHON_DANGER_PATTERNS = [
  /\bsubprocess\b/,
  /\bos\.system\b/,
  /__import__\s*\(\s*['"]os['"]/,
  /\bsocket\b/,
  /\beval\s*\(/,
  /\bexec\s*\(/,
  /\bopen\s*\(\s*['"]\/etc/,
];

function checkCodeSafety(args: RunCodeArgs): { ok: true } | { ok: false; reason: string } {
  if (args.runtime === "node") {
    try {
      // SyntaxError early — pas d'exécution
      new Function(args.code);
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        reason: `Syntax error JavaScript : ${err instanceof Error ? err.message : "unknown"}`,
      };
    }
  }
  // Python : pas de parser sync dispo, on regex blacklist (best-effort)
  for (const pattern of PYTHON_DANGER_PATTERNS) {
    if (pattern.test(args.code)) {
      return {
        ok: false,
        reason: `Pattern dangereux détecté (${pattern.source}). Refus pré-exécution.`,
      };
    }
  }
  return { ok: true };
}

// ── Public API ──────────────────────────────────────────────────

export function buildExtrasMediaTools(opts: {
  scope: TenantScope;
  eventBus: RunEventBus;
  runId: string;
  threadId?: string;
}): AiToolMap {
  const { scope, eventBus, runId, threadId } = opts;
  const threadOrWorkspace = threadId ?? scope.workspaceId;

  const generateAudio: Tool<GenerateAudioArgs, unknown> = {
    description:
      "Génère un fichier audio TTS (text-to-speech) via ElevenLabs depuis un texte. " +
      "Use this when the user asks 'lis ce paragraphe', 'transforme en audio', " +
      "'voix off pour ce script'. Pas de confirm — coût bas (~$0.01/run), action réversible.",
    inputSchema: jsonSchema<GenerateAudioArgs>({
      type: "object",
      required: ["text"],
      properties: {
        text: { type: "string", description: "Texte à lire (max ~5000 chars pour qualité)." },
        voiceId: { type: "string", description: "ID voix ElevenLabs (optionnel)." },
        tone: {
          type: "string",
          description: "Tone de la persona (warm/professional/dramatic). Résolu côté worker.",
        },
      },
    }),
    execute: async (args) => {
      const text = args.text.trim();
      if (!text) return "Erreur : text vide. Précise le contenu à lire.";

      // P0-5 : content moderation AVANT crédit + enqueue.
      const blocked = await ensureContentAllowed(text);
      if (blocked) return blocked;

      const assetId = randomUUID();
      // Guard crédits avant tout side-effect (storeAsset/enqueue) — P0-4.
      const insufficient = await ensureCreditsOrMessage({
        scope,
        jobKind: "audio-gen",
        estimatedCostUsd: 0.01,
        jobId: assetId,
      });
      if (insufficient) return insufficient;

      await storeAsset({
        id: assetId,
        threadId: threadOrWorkspace,
        kind: "report",
        title: text.slice(0, 80),
        summary: text.slice(0, 200),
        contentRef: "",
        createdAt: Date.now(),
        provenance: {
          providerId: "system",
          userId: scope.userId,
          tenantId: scope.tenantId,
          workspaceId: scope.workspaceId,
          metadata: {
            prompt: text,
            ...(args.tone ? { tone: args.tone } : {}),
          },
        },
      });

      const variantId = await createVariant({
        assetId,
        kind: "audio",
        status: "pending",
        provider: "elevenlabs",
      });

      const payload: AudioGenInput & { variantId: string | null; variantKind: string } = {
        jobKind: "audio-gen",
        userId: scope.userId ?? "anonymous",
        tenantId: scope.tenantId,
        workspaceId: scope.workspaceId,
        assetId,
        estimatedCostUsd: 0.01,
        text,
        voiceId: args.voiceId,
        tone: args.tone,
        variantId,
        variantKind: "audio",
      };
      try {
        await enqueueJob(payload, { idempotencyKey: assetId });
      } catch (err) {
        console.error("[generate_audio] enqueue failed:", err);
        return `Erreur enqueue : ${err instanceof Error ? err.message : "unknown"}`;
      }

      eventBus.emit({
        type: "stage_request",
        run_id: runId,
        stage: { mode: "asset", assetId, variantKind: "audio" },
      });

      return "Audio en cours de génération. 5-10s d'attente.";
    },
  };

  const parseDocument: Tool<ParseDocumentArgs, unknown> = {
    description:
      "Parse un document (PDF, DOCX, etc.) en markdown structuré via LlamaParse. " +
      "Use this when the user fournit une URL de fichier et demande 'parse ce PDF', " +
      "'extrais le contenu de ce document', 'résume ce contrat'. Pas de confirm — read-only.",
    inputSchema: jsonSchema<ParseDocumentArgs>({
      type: "object",
      required: ["fileUrl", "fileName", "mimeType"],
      properties: {
        fileUrl: {
          type: "string",
          description: "URL publique du document (signed URL OK).",
        },
        fileName: { type: "string", description: "Nom original du fichier (ex: contrat.pdf)." },
        mimeType: {
          type: "string",
          description:
            "MIME type (ex: application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document).",
        },
      },
    }),
    execute: async (args) => {
      const url = args.fileUrl.trim();
      if (!url) return "Erreur : fileUrl vide.";

      const assetId = randomUUID();
      const insufficient = await ensureCreditsOrMessage({
        scope,
        jobKind: "document-parse",
        estimatedCostUsd: 0.005,
        jobId: assetId,
      });
      if (insufficient) return insufficient;

      await storeAsset({
        id: assetId,
        threadId: threadOrWorkspace,
        kind: "document",
        title: args.fileName.slice(0, 80),
        summary: `Parse de ${args.fileName}`,
        contentRef: "",
        createdAt: Date.now(),
        provenance: {
          providerId: "system",
          userId: scope.userId,
          tenantId: scope.tenantId,
          workspaceId: scope.workspaceId,
        },
      });

      const variantId = await createVariant({
        assetId,
        kind: "text",
        status: "pending",
        provider: "llamaparse",
      });

      const payload: DocumentParseInput & { variantId: string | null; variantKind: string } = {
        jobKind: "document-parse",
        userId: scope.userId ?? "anonymous",
        tenantId: scope.tenantId,
        workspaceId: scope.workspaceId,
        assetId,
        estimatedCostUsd: 0.005,
        fileUrl: url,
        fileName: args.fileName,
        mimeType: args.mimeType,
        provider: "llamaparse",
        variantId,
        variantKind: "text",
      };
      try {
        await enqueueJob(payload, { idempotencyKey: assetId });
      } catch (err) {
        console.error("[parse_document] enqueue failed:", err);
        return `Erreur enqueue : ${err instanceof Error ? err.message : "unknown"}`;
      }

      eventBus.emit({
        type: "stage_request",
        run_id: runId,
        stage: { mode: "asset", assetId, variantKind: "text" },
      });

      return `Parsing en cours pour "${args.fileName}". 5-30s d'attente.`;
    },
  };

  const generateVideo: Tool<GenerateVideoArgs, unknown> = {
    description:
      "Génère une vidéo (avatar parlant via HeyGen, ou text-to-video Runway) depuis un prompt. " +
      "⚠️ Coût élevé (~$0.50/run) + temps long (30-120s). " +
      "**Pattern preview obligatoire** : appelle d'abord avec _preview=true (défaut) pour " +
      "afficher un draft, puis _preview=false après confirmation explicite de l'utilisateur. " +
      "Use this when the user asks 'fais une vidéo de X', 'crée un avatar qui dit Y'.",
    inputSchema: jsonSchema<GenerateVideoArgs>({
      type: "object",
      required: ["prompt"],
      properties: {
        prompt: { type: "string", description: "Description de la vidéo à générer." },
        scriptText: { type: "string", description: "Script à dire (avatar HeyGen)." },
        provider: {
          type: "string",
          enum: ["heygen", "runway"],
          description: "heygen = avatar parlant, runway = text-to-video. Default: runway.",
        },
        durationSeconds: { type: "number", description: "Durée cible (5-30s)." },
        avatarId: { type: "string", description: "ID avatar HeyGen (optionnel)." },
        voiceId: { type: "string", description: "ID voix HeyGen (optionnel)." },
        _preview: {
          type: "boolean",
          description:
            "true (défaut) = retourne un draft pour confirmation. false = exécute après confirm user.",
        },
      },
    }),
    execute: async (args) => {
      const prompt = args.prompt.trim();
      if (!prompt) return "Erreur : prompt vide.";
      const isPreview = args._preview !== false;

      const provider = args.provider ?? "runway";
      const duration = args.durationSeconds ?? 5;

      if (isPreview) {
        return [
          `**Preview génération vidéo** (provider: ${provider}, durée: ${duration}s)`,
          ``,
          `Prompt : ${prompt.slice(0, 200)}`,
          args.scriptText ? `Script : ${args.scriptText.slice(0, 200)}` : "",
          ``,
          `⚠️ Coût ≈ $0.50, durée 30-120 secondes.`,
          ``,
          `Réponds **confirmer** pour lancer, ou ajuste le prompt.`,
        ]
          .filter(Boolean)
          .join("\n");
      }

      // P0-5 : content moderation sur prompt + scriptText combinés.
      const moderationText = [prompt, args.scriptText].filter(Boolean).join("\n");
      const blocked = await ensureContentAllowed(moderationText);
      if (blocked) return blocked;

      const assetId = randomUUID();
      const insufficient = await ensureCreditsOrMessage({
        scope,
        jobKind: "video-gen",
        estimatedCostUsd: 0.5,
        jobId: assetId,
      });
      if (insufficient) return insufficient;

      await storeAsset({
        id: assetId,
        threadId: threadOrWorkspace,
        kind: "report",
        title: prompt.slice(0, 80),
        summary: prompt.slice(0, 200),
        contentRef: "",
        createdAt: Date.now(),
        provenance: {
          providerId: "system",
          userId: scope.userId,
          tenantId: scope.tenantId,
          workspaceId: scope.workspaceId,
          metadata: {
            prompt,
            ...(args.scriptText ? { scriptText: args.scriptText } : {}),
            provider,
          },
        },
      });

      const variantId = await createVariant({
        assetId,
        kind: "video",
        status: "pending",
        provider,
      });

      const payload: VideoGenInput & { variantId: string | null; variantKind: string } = {
        jobKind: "video-gen",
        userId: scope.userId ?? "anonymous",
        tenantId: scope.tenantId,
        workspaceId: scope.workspaceId,
        assetId,
        estimatedCostUsd: 0.5,
        prompt,
        scriptText: args.scriptText,
        provider,
        durationSeconds: duration,
        avatarId: args.avatarId,
        voiceId: args.voiceId,
        variantId,
        variantKind: "video",
      };
      try {
        await enqueueJob(payload, { idempotencyKey: assetId });
      } catch (err) {
        console.error("[generate_video] enqueue failed:", err);
        return `Erreur enqueue : ${err instanceof Error ? err.message : "unknown"}`;
      }

      eventBus.emit({
        type: "stage_request",
        run_id: runId,
        stage: { mode: "asset", assetId, variantKind: "video" },
      });

      return "Vidéo en cours de génération. 30-120s d'attente — je t'amène sur l'asset.";
    },
  };

  const runCode: Tool<RunCodeArgs, unknown> = {
    description:
      "Exécute du code Python ou Node.js dans un sandbox isolé E2B (pas de réseau, FS éphémère). " +
      "**Pattern preview obligatoire** : appelle d'abord avec _preview=true (défaut), puis " +
      "_preview=false après confirmation. Validation pré-exécution : " +
      "Node SyntaxError check + Python regex blacklist (subprocess, os.system, eval, exec, etc.).",
    inputSchema: jsonSchema<RunCodeArgs>({
      type: "object",
      required: ["code", "runtime"],
      properties: {
        code: { type: "string", description: "Code source à exécuter." },
        runtime: {
          type: "string",
          enum: ["python", "node"],
          description: "Runtime sandbox.",
        },
        _preview: {
          type: "boolean",
          description:
            "true (défaut) = preview avec snippet code. false = exécute après confirm user.",
        },
      },
    }),
    execute: async (args) => {
      const code = args.code.trim();
      if (!code) return "Erreur : code vide.";

      // Validation pré-exécution (toujours, même en preview)
      const safety = checkCodeSafety(args);
      if (!safety.ok) {
        return `🚫 Code refusé : ${safety.reason}`;
      }

      const isPreview = args._preview !== false;
      if (isPreview) {
        const snippet = code.split("\n").slice(0, 20).join("\n");
        const truncated =
          code.split("\n").length > 20
            ? `\n... (${code.split("\n").length - 20} lignes de plus)`
            : "";
        return [
          `**Preview exécution code** (runtime: ${args.runtime})`,
          `\`\`\`${args.runtime === "python" ? "python" : "javascript"}`,
          snippet + truncated,
          "```",
          ``,
          `Sandbox E2B (FS isolé, pas de réseau). Coût ≈ $0.001, durée 5-60s.`,
          ``,
          `Réponds **confirmer** pour lancer.`,
        ].join("\n");
      }

      const assetId = randomUUID();
      const insufficient = await ensureCreditsOrMessage({
        scope,
        jobKind: "code-exec",
        estimatedCostUsd: 0.001,
        jobId: assetId,
      });
      if (insufficient) return insufficient;

      await storeAsset({
        id: assetId,
        threadId: threadOrWorkspace,
        kind: "artifact",
        title: `Code ${args.runtime}`,
        summary: code.slice(0, 200),
        contentRef: "",
        createdAt: Date.now(),
        provenance: {
          providerId: "system",
          userId: scope.userId,
          tenantId: scope.tenantId,
          workspaceId: scope.workspaceId,
        },
      });

      const variantId = await createVariant({
        assetId,
        kind: "code",
        status: "pending",
        provider: "e2b",
      });

      const payload: CodeExecInput & { variantId: string | null; variantKind: string } = {
        jobKind: "code-exec",
        userId: scope.userId ?? "anonymous",
        tenantId: scope.tenantId,
        workspaceId: scope.workspaceId,
        assetId,
        estimatedCostUsd: 0.001,
        code,
        runtime: args.runtime,
        timeoutMs: 60000,
        variantId,
        variantKind: "code",
      };
      try {
        await enqueueJob(payload, { idempotencyKey: assetId });
      } catch (err) {
        console.error("[run_code] enqueue failed:", err);
        return `Erreur enqueue : ${err instanceof Error ? err.message : "unknown"}`;
      }

      eventBus.emit({
        type: "stage_request",
        run_id: runId,
        stage: { mode: "asset", assetId, variantKind: "code" },
      });

      return `Exécution ${args.runtime} en cours dans sandbox E2B. 5-60s d'attente.`;
    },
  };

  return {
    generate_audio: generateAudio,
    parse_document: parseDocument,
    generate_video: generateVideo,
    run_code: runCode,
  };
}
