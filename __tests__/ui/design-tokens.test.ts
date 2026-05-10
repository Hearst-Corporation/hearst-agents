import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const globalsCss = readFileSync(path.join(__dirname, "../../app/globals.css"), "utf8");

describe("design tokens (app/globals.css)", () => {
  it("expose les surfaces et le rail pour Tailwind @theme", () => {
    expect(globalsCss).toContain("--surface:");
    expect(globalsCss).toContain("--rail:");
    expect(globalsCss).toContain("--color-surface:");
    expect(globalsCss).toContain("--color-rail:");
  });

  it("garde le canvas et l'accent documentés", () => {
    expect(globalsCss).toContain("--background:");
    expect(globalsCss).toContain("--cyan-accent:");
    expect(globalsCss).toContain("--color-background:");
    expect(globalsCss).toContain("--color-cyan-accent:");
  });

  it("supporte le design Vision OS avec des backgrounds transparents", () => {
    // Le design Vision OS (pivot 2026-05-10) utilise des fonds transparents
    // pour laisser passer le vision-ambient-bg
    expect(globalsCss).toContain("--background: transparent;");
    expect(globalsCss).toContain("--rail: transparent;");
  });
});
