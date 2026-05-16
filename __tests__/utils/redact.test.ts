import { describe, expect, it } from "vitest";
import { redactId } from "@/lib/utils/redact";

describe("redactId", () => {
  it("retourne 'anonymous' pour null", () => {
    expect(redactId(null)).toBe("anonymous");
  });

  it("retourne 'anonymous' pour undefined", () => {
    expect(redactId(undefined)).toBe("anonymous");
  });

  it("retourne 'anonymous' pour string vide", () => {
    expect(redactId("")).toBe("anonymous");
  });

  it("conserve les 8 premiers caractères par défaut", () => {
    expect(redactId("abc123def")).toBe("abc123de");
  });

  it("conserve un UUID complet sur ses 8 premiers caractères", () => {
    expect(redactId("550e8400-e29b-41d4-a716-446655440000")).toBe("550e8400");
  });

  it("accepte un keep custom", () => {
    expect(redactId("abc123def", 4)).toBe("abc1");
  });

  it("accepte un keep custom de 2", () => {
    expect(redactId("abc", 2)).toBe("ab");
  });

  it("ne pad pas une string plus courte que keep", () => {
    // slice(0, 8) sur "ab" → "ab", pas de pad
    expect(redactId("ab", 8)).toBe("ab");
  });

  it("retourne la string entière si exactement de longueur keep", () => {
    expect(redactId("abcdefgh", 8)).toBe("abcdefgh");
  });

  it("retourne 'anonymous' si keep = 0 (safeguard never expose full id)", () => {
    expect(redactId("abc", 0)).toBe("anonymous");
  });

  it("retourne 'anonymous' si keep négatif (safeguard)", () => {
    expect(redactId("abc", -1)).toBe("anonymous");
  });
});
