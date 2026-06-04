/**
 * Cortex Remember tool — écriture en mémoire long-terme Cortex (LTM distant).
 *
 * Expose `cortex_remember` comme tool natif invocable par le LLM quand l'user
 * demande explicitement de mémoriser / retenir un fait ("mémorise X", "retiens
 * que Y", "souviens-toi de Z"). Symétrique de `cortex_search` (lecture).
 *
 * Raccorde la fonction EXISTANTE `pushToCortexMemory` (cortex-client.ts) — pas
 * de nouveau système : même endpoint HMAC `/api/ingest/helm` que le push de
 * chat-turns. Le fait à retenir est porté par `userMessage`.
 *
 * Fail-soft strict : env manquante / erreur réseau → string lisible, jamais de throw.
 */

import type { Tool } from "ai";
import { jsonSchema } from "ai";
import { pushToCortexMemory } from "@/lib/memory/cortex-client";
import type { TenantScope } from "@/lib/multi-tenant/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AiToolMap = Record<string, Tool<any, any>>;

interface CortexRememberArgs {
  fact: string;
}

export function buildCortexRememberTools(opts: { scope: TenantScope }): AiToolMap {
  // Propagation tenant : l'écriture est scopée au tenant/user courant (le push
  // transporte user_id + tenant_id → Cortex isole la mémoire par utilisateur).
  const { userId, tenantId } = opts.scope;

  const cortexRemember: Tool<CortexRememberArgs, unknown> = {
    description:
      "Mémorise durablement un fait dans la mémoire long-terme Cortex de l'utilisateur. " +
      "Use this UNIQUEMENT quand l'utilisateur demande explicitement de retenir/mémoriser/" +
      "noter quelque chose pour plus tard ('mémorise que…', 'retiens X', 'souviens-toi de Y', " +
      "'note que Z'). Le fait sera retrouvable ensuite via cortex_search. Ne PAS utiliser pour " +
      "une simple conversation — seulement sur demande explicite de mémorisation.",
    inputSchema: jsonSchema<CortexRememberArgs>({
      type: "object",
      required: ["fact"],
      properties: {
        fact: {
          type: "string",
          description:
            "Le fait exact à mémoriser, formulé de façon autonome et complète (ex: " +
            "'La couleur d'accent Cortex est #3FA7E0 sur fond #050B1A').",
        },
      },
    }),
    execute: async (args) => {
      const fact = (args.fact ?? "").trim();
      if (!fact) return "Erreur : rien à mémoriser (fait vide).";
      if (!userId || !tenantId) {
        return "La mémorisation Cortex nécessite un contexte utilisateur (non résolu). Rien n'a été enregistré.";
      }

      try {
        const ok = await pushToCortexMemory({
          userId,
          tenantId,
          userMessage: fact,
          assistantReply: "",
        });
        return ok
          ? `Mémorisé dans Cortex : "${fact.slice(0, 120)}".`
          : "La mémorisation Cortex n'a pas abouti (service indisponible). Rien n'a été enregistré.";
      } catch (err: unknown) {
        console.error("[cortex_remember] failed:", err);
        const name = err instanceof Error ? err.name : "UnknownError";
        return `Erreur mémorisation Cortex : ${name}`;
      }
    },
  };

  return {
    cortex_remember: cortexRemember,
  };
}
