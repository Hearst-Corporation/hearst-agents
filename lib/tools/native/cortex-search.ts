/**
 * Cortex Search tool — recherche dans la mémoire long-terme Cortex (LTM distant).
 *
 * Expose `cortex_search` comme tool natif invocable par le LLM quand l'user
 * demande de chercher dans ses notes, son historique, ses décisions passées.
 *
 * Fail-soft strict : toute erreur réseau/Cortex → string lisible, jamais de throw.
 * La logique fetch est centralisée dans cortex-client.ts (anti-duplication).
 */

import type { Tool } from "ai";
import { jsonSchema } from "ai";
import { searchCortexMemory } from "@/lib/memory/cortex-client";
import type { TenantScope } from "@/lib/multi-tenant/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AiToolMap = Record<string, Tool<any, any>>;

interface CortexSearchArgs {
  query: string;
  limit?: number;
}

const MAX_EXCERPT_CHARS = 200;

export function buildCortexSearchTools(opts: { scope: TenantScope }): AiToolMap {
  // scope réservé pour propagation tenant future (cf. plan multi-tenant)
  void opts.scope;

  const cortexSearch: Tool<CortexSearchArgs, unknown> = {
    description:
      "Recherche dans la mémoire long-terme Cortex (vault de 287k notes : 2 ans de décisions, " +
      "projets, conversations, historique). Use this quand l'utilisateur demande 'cherche dans " +
      "mes notes', 'qu'est-ce que j'avais écrit/décidé sur X', 'retrouve mes infos sur Y', " +
      "'mon historique de Z'. Complémentaire au knowledge graph local (query_knowledge_graph) : " +
      "Cortex couvre l'historique profond, le KG couvre les entités récentes. Retourne les notes " +
      "pertinentes avec titre, extrait et chemin.",
    inputSchema: jsonSchema<CortexSearchArgs>({
      type: "object",
      required: ["query"],
      properties: {
        query: {
          type: "string",
          description:
            "Requête en français/anglais. Recherche hybride (sémantique + lexicale) dans le vault Cortex.",
        },
        limit: {
          type: "number",
          description: "Top-K notes à retourner (default 5, max 25).",
        },
      },
    }),
    execute: async (args) => {
      const query = (args.query ?? "").trim();
      if (!query) return "Erreur : requête vide.";

      try {
        const results = await searchCortexMemory({ query, k: args.limit });

        if (results.length === 0) {
          return `Aucune note pertinente trouvée dans Cortex pour "${query}".`;
        }

        const lines = [
          `${results.length} note(s) trouvée(s) dans Cortex :`,
          ...results.map((r) => {
            const score = r.similarity.toFixed(3);
            const title = r.metadata?.title ?? r.sourceId;
            const excerpt = (r.textExcerpt ?? "").slice(0, MAX_EXCERPT_CHARS).replace(/\n/g, " ");
            return `- [${score}] ${title} — ${excerpt}`;
          }),
        ];

        return lines.join("\n");
      } catch (err: unknown) {
        console.error("[cortex_search] failed:", err);
        // err.name seulement (jamais err.message qui peut contenir l'URL interne Cortex)
        const name = err instanceof Error ? err.name : "UnknownError";
        return `Erreur recherche Cortex : ${name}`;
      }
    },
  };

  return {
    cortex_search: cortexSearch,
  };
}
