import { describe, expect, it } from "vitest";
import { escapeHtml } from "@/lib/utils/escape-html";

describe("escapeHtml", () => {
  it("échappe l'ampersand", () => {
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });

  it("échappe les chevrons", () => {
    expect(escapeHtml("<div>")).toBe("&lt;div&gt;");
  });

  it("échappe les guillemets doubles", () => {
    expect(escapeHtml('say "hi"')).toBe("say &quot;hi&quot;");
  });

  it("échappe les apostrophes", () => {
    expect(escapeHtml("it's")).toBe("it&#39;s");
  });

  it("échappe les 5 caractères en une passe", () => {
    expect(escapeHtml(`& < > " '`)).toBe("&amp; &lt; &gt; &quot; &#39;");
  });

  it("séquence mixte avec contenu", () => {
    expect(escapeHtml('<script>alert("xss & evil")</script>')).toBe(
      "&lt;script&gt;alert(&quot;xss &amp; evil&quot;)&lt;/script&gt;",
    );
  });

  it("string vide", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("chaîne sans caractère HTML reste inchangée", () => {
    expect(escapeHtml("hello world 123")).toBe("hello world 123");
  });

  it("ne double-échappe pas l'ampersand des entités existantes (re-encode)", () => {
    expect(escapeHtml("&amp;")).toBe("&amp;amp;");
  });
});
