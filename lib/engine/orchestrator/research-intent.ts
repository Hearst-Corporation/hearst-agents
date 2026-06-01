/**
 * Research Intent Classifier — deterministic pattern matching.
 *
 * Detects when user input requires web search / external research,
 * and when output should become a persistent asset (report).
 *
 * IMPORTANT — la détection research route le message vers `runResearchReport`
 * (web-search → narration markdown → PDF) qui n'a accès NI aux tools natifs
 * (`get_crypto_prices`, `get_stock_quotes`, `propose_report_spec`) NI aux
 * apps Composio. Si la requête correspond à un template catalogue ou à un
 * tool natif déterministe, on doit court-circuiter le research path —
 * voir `shouldBypassResearchPath()` ci-dessous.
 */

const RESEARCH_PATTERNS = [
  "recherche",
  "research",
  "cherche",
  "actualité",
  "actualite",
  "news",
  "rapport",
  "report",
  "analyse",
  "analyze",
  "analysis",
  "benchmark",
  "veille",
  "bitcoin",
  "crypto",
  "ethereum",
  "blockchain",
  "market",
  "marché",
  "marche",
  "tendance",
  "trend",
  "compare",
  "comparaison",
  "comparison",
  "enquête",
  "enquete",
  "investigate",
  "étude",
  "etude",
  "study",
  "résumé de",
  "resume de",
  "summary",
  "what is happening",
  "que se passe",
  "dernières nouvelles",
  "latest",
];

const REPORT_PATTERNS = [
  "rapport",
  "report",
  "analyse",
  "analysis",
  "étude",
  "etude",
  "study",
  "benchmark",
  "document",
  "synthèse",
  "synthese",
  "synthesis",
  "résumé",
  "resume",
  "summary",
  "brief",
  "briefing",
  "veille",
  "fais-moi un",
  "fais moi un",
  "génère",
  "genere",
  "generate",
  "rédige",
  "redige",
  "write",
  "prépare",
  "prepare",
];

export function isResearchIntent(input: string): boolean {
  const lower = input.toLowerCase();
  return RESEARCH_PATTERNS.some((p) => lower.includes(p));
}

export function isReportIntent(input: string): boolean {
  const lower = input.toLowerCase();
  return REPORT_PATTERNS.some((p) => lower.includes(p));
}

export function extractResearchQuery(input: string): string {
  return (
    input
      .replace(
        /^(fais[- ]moi un (rapport|résumé|document|analyse)\s+(sur|de|du|des|à propos de)\s*)/i,
        "",
      )
      .replace(/^(recherche\s+(sur|de|du|des)\s*)/i, "")
      .replace(/^(actualit[ée]s?\s+(sur|de|du|des)\s*)/i, "")
      .trim() || input
  );
}

// ── Catalogue templates ──────────────────────────────────────────────
// Quand le message matche un template du catalogue Reports, on laisse
// Sonnet appeler `propose_report_spec` (qui sait composer les sources
// cross-app) plutôt que `runResearchReport` (web-only).
const CATALOGUE_REPORT_PATTERNS = [
  "founder cockpit",
  "customer 360",
  "customer360",
  "deal-to-cash",
  "deal to cash",
  "financial p&l",
  "financial pnl",
  "financial p l",
  "product analytics",
  "support health",
  "engineering velocity",
  "marketing aarrr",
  "hr/people",
  "hr people",
  "hr / people",
  "hospitality revpar",
  "revpar",
  "guest satisfaction",
  "hospitality daily brief",
  "daily brief hospitality",
];

function isCatalogueReportRequest(input: string): boolean {
  const lower = input.toLowerCase();
  return CATALOGUE_REPORT_PATTERNS.some((p) => lower.includes(p));
}

// ── Native deterministic tools ───────────────────────────────────────
// Le research path est web-only. Si la requête peut être servie par un
// tool natif (prix crypto/stocks live, KG query, mission ops), on laisse
// Sonnet la router via streamText. Cap : on n'attrape que les phrases
// non-ambiguës pour ne pas casser une vraie recherche éditoriale ("analyse
// le marché crypto" reste research, "prix du bitcoin" devient native).
const NATIVE_TOOL_PATTERNS = [
  // Crypto live prices — `get_crypto_prices` (CoinGecko)
  /\bprix\s+(du|des|de|d'|d')?\s*(btc|eth|sol|bitcoin|ethereum|solana|crypto|tokens?|coins?)\b/i,
  /\bcours\s+(du|des|de|d'|d')?\s*(btc|eth|sol|bitcoin|ethereum|solana|crypto)\b/i,
  /\b(btc|eth|sol|bitcoin|ethereum|solana)\s+(maintenant|now|aujourd'hui|today|live)\b/i,
  // TradFi live quotes — `get_stock_quotes` (Yahoo Finance)
  /\bcours\s+([A-Z]{2,5})\b/,
  /\bcot(ation|ations)\s+([A-Z]{2,5})\b/,
];

function matchesNativeDeterministicTool(input: string): boolean {
  return NATIVE_TOOL_PATTERNS.some((p) => p.test(input));
}

// ── Memory / vault queries ───────────────────────────────────────────
// Quand le message pointe vers la mémoire personnelle (Cortex vault,
// notes Obsidian, souvenirs), le research path web-only est contre-productif.
// On bypass → AI pipeline → cortex_search tool appelé par le LLM.
// Patterns intentionnellement larges sur "ma mémoire / mon vault / mes notes"
// mais pas sur "recherche" seul (qui reste légitime web).
const MEMORY_QUERY_PATTERNS = [
  // Mémoire explicite
  /\b(dans|de|depuis)\s+(ma|mon|mes)\s+(m[eé]moire|vault|notes?|obsidian|journal)\b/i,
  /\b(ma|mon|mes)\s+(m[eé]moire|vault|notes?|obsidian|journal)\b/i,
  /\bcortex\b/i,
  /\bvault\b/i,
  // Verbes de rappel mémoire
  /\b(souviens?|rappelle?(-toi)?|tu\s+sais)\b/i,
  /\bqu[e']est-ce\s+que\s+tu\s+sais\b/i,
  /\bce\s+que\s+tu\s+sais\b/i,
  // "cherche dans mes notes / mon vault / ma mémoire"
  /cherche\s+(dans|parmi)\s+(mes?|mon|ma)\b/i,
  /\b(trouve|retrouve)\s+(dans|parmi)\s+(mes?|mon|ma)\b/i,
];

function isMemoryQuery(input: string): boolean {
  return MEMORY_QUERY_PATTERNS.some((p) => p.test(input));
}

/**
 * Décide si une requête doit court-circuiter le research path.
 * Retourne `true` si la requête est mieux servie par streamText + tools
 * (catalogue cross-app via `propose_report_spec`, tools natifs déterministes,
 * ou query mémoire Cortex via `cortex_search`).
 */
export function shouldBypassResearchPath(input: string): boolean {
  return (
    isCatalogueReportRequest(input) || matchesNativeDeterministicTool(input) || isMemoryQuery(input)
  );
}
