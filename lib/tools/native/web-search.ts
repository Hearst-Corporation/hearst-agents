/**
 * Web search — exposé à la pipeline IA via wrapping de lib/tools/handlers/web-search.ts.
 *
 * Le handler existant route par intent vers Perplexity / Tavily / Exa avec fallback
 * et cache Redis 24h. Ce fichier l'expose comme tool natif au LLM (alongside
 * Google, Composio, hearst-actions, enrich…) pour combler le gap "fetch real-time
 * info" — actualités, prix, données publiques, recherche factuelle.
 */

import type { Tool } from "ai";
import { jsonSchema } from "ai";
import { fenceUntrusted } from "@/lib/memory/untrusted-fence";
import { searchWeb } from "@/lib/tools/handlers/web-search";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AiToolMap = Record<string, Tool<any, any>>;

interface WebSearchArgs {
  query: string;
}

interface WebSearchToolsOpts {
  tenantId?: string;
}

function formatResult(
  query: string,
  summary: string,
  results: Array<{ title: string; url: string; snippet: string }>,
): string {
  const lines: string[] = [];
  lines.push(`Recherche : ${query}`);
  lines.push("");

  if (summary && summary !== "search_unavailable") {
    const fencedSummary = fenceUntrusted("search", summary.slice(0, 1500), {
      source: "web_summary",
      query,
    });
    lines.push(fencedSummary);
    lines.push("");
  }

  if (results.length > 0) {
    lines.push("Sources :");
    results.slice(0, 5).forEach((r, i) => {
      const snippet = r.snippet ? r.snippet.slice(0, 200) : "";
      const content = `${r.title}\n${snippet}`.trim();
      const fenced = fenceUntrusted("search", content, {
        url: r.url,
        index: String(i + 1),
      });
      lines.push(fenced);
    });
  }
  return lines.join("\n");
}

export function buildWebSearchTools(opts?: WebSearchToolsOpts): AiToolMap {
  const webSearchTool: Tool<WebSearchArgs, string> = {
    description:
      "Recherche d'informations éditoriales sur le web (actualités, faits, définitions, météo, contexte général). " +
      "Routing automatique : Perplexity pour synthèse, Tavily pour factuel, Exa pour sémantique. Cache 24h. " +
      "Use this dès que le user demande une info qui change dans le temps ou que tu n'as pas dans tes connaissances. " +
      "**NE PAS utiliser pour les prix crypto live** — utilise `get_crypto_prices` (CoinGecko, gratuit). " +
      "**NE PAS utiliser pour les cotations actions live** — utilise `get_stock_quotes` (Yahoo Finance, gratuit). " +
      "**NE PAS utiliser pour des données utilisateur** (emails, agenda, deals, fichiers) — passe par les tools natifs Google/Composio.",
    inputSchema: jsonSchema<WebSearchArgs>({
      type: "object",
      required: ["query"],
      properties: {
        query: {
          type: "string",
          description:
            "Requête de recherche en langage naturel (ex: 'dernières actualités sur l'IA générative', 'capitale du Pérou', 'météo Paris demain').",
        },
      },
    }),
    execute: async (args) => {
      try {
        const result = await searchWeb(args.query, { tenantId: opts?.tenantId });
        if (result.error === "search_unavailable") {
          return "Recherche web indisponible (les 3 providers ont échoué). Réessaie plus tard ou reformule la requête.";
        }
        return formatResult(result.query, result.summary, result.results);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return `Échec de recherche : ${msg}`;
      }
    },
  };

  return {
    web_search: webSearchTool,
  };
}
