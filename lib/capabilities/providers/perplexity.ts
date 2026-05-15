/**
 * Perplexity provider — recherche approfondie avec synthèse et citations.
 *
 * Perplexity combine un LLM et un moteur de recherche temps-réel. Idéal pour
 * les requêtes de recherche complexes qui nécessitent une synthèse structurée
 * avec sources vérifiées. Contraste avec Exa (sémantique) et Tavily (factuel
 * rapide) — Perplexity est le choix pour les analyses multi-sources.
 *
 * API : compatible OpenAI chat completions
 * Modèles : sonar (rapide) / sonar-pro (qualité) / sonar-reasoning (raisonnement)
 */

export interface PerplexityResult {
  answer: string;
  citations: string[];
  model: string;
}

interface PerplexityChoice {
  message?: { content?: string };
  finish_reason?: string;
}

interface PerplexityApiResponse {
  choices?: PerplexityChoice[];
  citations?: string[];
  model?: string;
}

// Timeout dur 10s — sonar-pro met typiquement 5-12s, au-delà on bascule
// sur le provider suivant (Tavily) plutôt que de bloquer le run. Audit
// E2E 2026-05-08 2.2 a montré 47s de latence cumul → cap obligatoire.
const PERPLEXITY_TIMEOUT_MS = 10_000;

// Circuit breaker : 3 timeouts consécutifs → circuit ouvert 5min
let _consecutiveTimeouts = 0;
let _circuitOpenUntil = 0;
const CIRCUIT_OPEN_MS = 5 * 60 * 1_000;
const TIMEOUT_THRESHOLD = 3;

export async function perplexitySearch(
  query: string,
  options?: {
    model?: "sonar" | "sonar-pro" | "sonar-reasoning";
    maxTokens?: number;
  },
): Promise<PerplexityResult> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    console.warn("[Perplexity] PERPLEXITY_API_KEY not set — skipping search");
    return { answer: "", citations: [], model: "" };
  }

  if (Date.now() < _circuitOpenUntil) {
    throw new Error("[Perplexity] circuit ouvert — fallback vers Tavily");
  }

  const model = options?.model ?? "sonar-pro";
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PERPLEXITY_TIMEOUT_MS);

  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "Réponds de façon concise et structurée. Cite tes sources. Langue : celle de la question.",
          },
          { role: "user", content: query },
        ],
        max_tokens: options?.maxTokens ?? 1024,
        return_citations: true,
      }),
      signal: ctrl.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`[Perplexity] Search failed ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = (await res.json()) as PerplexityApiResponse;

    _consecutiveTimeouts = 0;
    return {
      answer: data.choices?.[0]?.message?.content ?? "",
      citations: data.citations ?? [],
      model: data.model ?? model,
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      _consecutiveTimeouts++;
      if (_consecutiveTimeouts >= TIMEOUT_THRESHOLD) {
        _circuitOpenUntil = Date.now() + CIRCUIT_OPEN_MS;
        console.warn(`[Perplexity] circuit ouvert 5min après ${TIMEOUT_THRESHOLD} timeouts consécutifs`);
        _consecutiveTimeouts = 0;
      }
      throw new Error(`[Perplexity] Timeout after ${PERPLEXITY_TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
