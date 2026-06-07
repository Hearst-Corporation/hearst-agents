const TEST_KIMI_BASE_URL = "https://kimi.test/v1";

export interface KimiRuntimeConfig {
  apiKey: string;
  baseURL: string;
}

export function resolveKimiRuntimeConfig(
  env: Partial<NodeJS.ProcessEnv> = process.env,
): KimiRuntimeConfig {
  const apiKey = env.KIMI_API_KEY;
  const baseURL = env.KIMI_BASE_URL;

  if (!apiKey) {
    if (env.NODE_ENV === "test") {
      return { apiKey: "test-placeholder", baseURL: baseURL ?? TEST_KIMI_BASE_URL };
    }
    throw new Error("KIMI_API_KEY is not set — add the direct Kimi key to .env.local");
  }

  if (!baseURL) {
    if (env.NODE_ENV === "test") {
      return { apiKey, baseURL: TEST_KIMI_BASE_URL };
    }
    throw new Error(
      "KIMI_BASE_URL is not set — configure the direct Kimi OpenAI-compatible endpoint",
    );
  }

  return { apiKey, baseURL };
}
