import { describe, expect, it } from "vitest";
import {
  isPureConversational,
  resolveConversationalFastpathConfig,
} from "@/lib/engine/orchestrator/conversational-fastpath";

describe("conversational fast-path", () => {
  it("detects only short pure conversational prompts", () => {
    expect(isPureConversational("bonjour")).toBe(true);
    expect(isPureConversational("merci beaucoup")).toBe(true);
    expect(isPureConversational("qui es-tu ?")).toBe(true);

    expect(isPureConversational("cherche dans mes notes")).toBe(false);
    expect(isPureConversational("résume mes emails")).toBe(false);
    expect(isPureConversational("bonjour, envoie un message Slack")).toBe(false);
  });

  it("uses Kimi 2.5 by default when Kimi is configured", () => {
    expect(
      resolveConversationalFastpathConfig({
        KIMI_API_KEY: "kimi-key",
        KIMI_BASE_URL: "https://kimi.example/v1",
      }).model,
    ).toBe("kimi-k2.5");
  });

  it("keeps OpenAI mini fallback when Kimi is not configured", () => {
    const config = resolveConversationalFastpathConfig({
      OPENAI_API_KEY: "openai-key",
    });

    expect(config.baseURL).toBe("https://api.openai.com/v1");
    expect(config.model).toBe("gpt-4.1-mini");
  });

  it("allows an isolated fast-path provider override", () => {
    const config = resolveConversationalFastpathConfig({
      CONVERSATIONAL_FASTPATH_API_KEY: "minimax-key",
      CONVERSATIONAL_FASTPATH_BASE_URL: "https://minimax.example/v1",
      CONVERSATIONAL_FASTPATH_MODEL: "minimax-m2.5",
      KIMI_API_KEY: "kimi-key",
      KIMI_BASE_URL: "https://kimi.example/v1",
    });

    expect(config).toEqual({
      provider: "kimi",
      apiKey: "minimax-key",
      baseURL: "https://minimax.example/v1",
      model: "minimax-m2.5",
    });
  });
});
