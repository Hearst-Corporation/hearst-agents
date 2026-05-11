import { describe, it, expect } from "vitest";
import { redactForLangfuse, redactString } from "@/lib/observability/langfuse-redact";

describe("redactString", () => {
  it("strip email", () => {
    expect(redactString("contact: alice@example.com")).toBe("contact: [EMAIL]");
  });

  it("strip OpenAI key (sk-xxxxx)", () => {
    expect(redactString("key=sk-1234567890abcdef12345678")).toBe("key=[OPENAI_KEY]");
  });

  it("strip OpenAI project key (sk-proj-xxxxx)", () => {
    expect(redactString("key=sk-proj-1234567890abcdef12345678")).toBe("key=[OPENAI_KEY]");
  });

  it("strip Anthropic key (sk-ant-xxxxx)", () => {
    expect(redactString("key=sk-ant-api03-1234567890abcdef1234567890abcdef")).toBe(
      "key=[ANTHROPIC_KEY]",
    );
  });

  it("strip Google key (AIzaSy*)", () => {
    expect(redactString("key=AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ12345")).toBe("key=[GOOGLE_KEY]");
  });

  it("multiple patterns in same string", () => {
    const result = redactString("Email alice@x.com, key sk-1234567890abcdef12345678 done");
    expect(result).toBe("Email [EMAIL], key [OPENAI_KEY] done");
  });
});

describe("redactForLangfuse", () => {
  it("strip email in string", () => {
    expect(redactForLangfuse("contact: alice@example.com")).toBe("contact: [EMAIL]");
  });

  it("strip OpenAI key in string", () => {
    expect(redactForLangfuse("sk-1234567890abcdef12345678")).toBe("[OPENAI_KEY]");
  });

  it("récursif sur objet — champ sensible", () => {
    expect(redactForLangfuse({ system: "Hi alice@x.com" })).toEqual({
      system: "Hi [EMAIL]",
    });
  });

  it("récursif sur objet imbriqué", () => {
    const input = {
      metadata: { model: "claude-sonnet" },
      messages: [{ role: "user", content: "call alice@x.com" }],
    };
    const result = redactForLangfuse(input) as typeof input;
    // messages est un champ PII => redact récursif sur le tableau
    const messages = result.messages as Array<{ role: string; content: string }>;
    expect(messages[0].content).toBe("call [EMAIL]");
    // metadata.model non sensible — inchangé
    expect((result.metadata as { model: string }).model).toBe("claude-sonnet");
  });

  it("tableau de strings", () => {
    expect(redactForLangfuse(["hello", "sk-1234567890abcdef12345678"])).toEqual([
      "hello",
      "[OPENAI_KEY]",
    ]);
  });

  it("valeur non string/objet passée telle quelle", () => {
    expect(redactForLangfuse(42)).toBe(42);
    expect(redactForLangfuse(null)).toBe(null);
    expect(redactForLangfuse(true)).toBe(true);
  });
});
