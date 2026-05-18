import OpenAI from "openai";

// Client minimal pour le chat cockpit (rail droit).
// Priorité HYPERCLI_API_KEY (convention standardisée) puis KIMI_API_KEY (convention helm historique).
export const kimiCockpit = new OpenAI({
  apiKey: process.env.HYPERCLI_API_KEY ?? process.env.KIMI_API_KEY ?? "build-placeholder",
  baseURL:
    process.env.HYPERCLI_BASE_URL ?? process.env.KIMI_BASE_URL ?? "https://api.hypercli.com/v1",
});

export const KIMI_COCKPIT_MODEL = process.env.HYPERCLI_DEFAULT_MODEL ?? "kimi-k2.6";
