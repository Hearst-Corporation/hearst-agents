import { describe, expect, it } from "vitest";
import { z } from "zod";
import { validateForm } from "@/lib/forms/validate";

const Schema = z.object({
  name: z.string().min(1, "Nom requis"),
  url: z.string().url("URL invalide"),
  count: z.number().int().min(1, "Au moins 1"),
});

describe("validateForm", () => {
  it("retourne ok + data typée quand tout est valide", () => {
    const r = validateForm(Schema, {
      name: "Hook",
      url: "https://example.com",
      count: 3,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.name).toBe("Hook");
  });

  it("retourne le premier message par champ en cas d'échec", () => {
    const r = validateForm(Schema, { name: "", url: "nope", count: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.name).toBe("Nom requis");
      expect(r.errors.url).toBe("URL invalide");
      expect(r.errors.count).toBe("Au moins 1");
    }
  });

  it("ne surcharge pas un champ déjà erroné (premier message gagne)", () => {
    const Multi = z.object({
      v: z.string().min(3, "trop court").regex(/^\d+$/, "chiffres seulement"),
    });
    const r = validateForm(Multi, { v: "a" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.v).toBe("trop court");
  });

  it("range les erreurs racine sous '_'", () => {
    const Strict = z.object({ a: z.string() }).strict();
    const r = validateForm(Strict, { a: "x", extra: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(typeof r.errors._).toBe("string");
  });
});
