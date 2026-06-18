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

  it("uses gpt-4.1-nano by default with OpenAI key", () => {
    const config = resolveConversationalFastpathConfig({
      OPENAI_API_KEY: "sk-openai",
    });
    expect(config.model).toBe("gpt-4.1-nano");
    expect(config.provider).toBe("openai");
  });

  it("uses gpt-4.1-nano with no env vars (default)", () => {
    const config = resolveConversationalFastpathConfig({});
    expect(config.model).toBe("gpt-4.1-nano");
    expect(config.provider).toBe("openai");
  });

  it("allows an isolated fast-path provider override", () => {
    const config = resolveConversationalFastpathConfig({
      CONVERSATIONAL_FASTPATH_API_KEY: "minimax-key",
      CONVERSATIONAL_FASTPATH_BASE_URL: "https://minimax.example/v1",
      CONVERSATIONAL_FASTPATH_MODEL: "minimax-m2.5",
      OPENAI_API_KEY: "sk-openai",
    });

    expect(config).toEqual({
      provider: "openai",
      apiKey: "minimax-key",
      baseURL: "https://minimax.example/v1",
      model: "minimax-m2.5",
    });
  });
});
