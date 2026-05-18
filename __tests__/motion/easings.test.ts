/**
 * Tests unitaires — lib/motion/easings.ts
 *
 * Vérifie que chaque constante est un tableau de 4 nombres
 * (format attendu par l'API `ease` de Framer Motion pour cubic-bezier).
 */

import { describe, expect, it } from "vitest";
import { EASE_SPRING, EASE_STANDARD, EASE_VISION } from "../../lib/motion/easings";

describe("easings — format Framer Motion cubic-bezier", () => {
  it("EASE_VISION est un tableau de 4 nombres", () => {
    expect(Array.isArray(EASE_VISION)).toBe(true);
    expect(EASE_VISION).toHaveLength(4);
    for (const v of EASE_VISION) {
      expect(typeof v).toBe("number");
    }
  });

  it("EASE_SPRING est un tableau de 4 nombres", () => {
    expect(Array.isArray(EASE_SPRING)).toBe(true);
    expect(EASE_SPRING).toHaveLength(4);
    for (const v of EASE_SPRING) {
      expect(typeof v).toBe("number");
    }
  });

  it("EASE_STANDARD est un tableau de 4 nombres", () => {
    expect(Array.isArray(EASE_STANDARD)).toBe(true);
    expect(EASE_STANDARD).toHaveLength(4);
    for (const v of EASE_STANDARD) {
      expect(typeof v).toBe("number");
    }
  });

  it("EASE_VISION correspond au token --ease-vision (0.22,1,0.36,1)", () => {
    expect(EASE_VISION[0]).toBe(0.22);
    expect(EASE_VISION[1]).toBe(1);
    expect(EASE_VISION[2]).toBe(0.36);
    expect(EASE_VISION[3]).toBe(1);
  });

  it("EASE_SPRING correspond au token --ease-spring (0.16,1,0.3,1)", () => {
    expect(EASE_SPRING[0]).toBe(0.16);
    expect(EASE_SPRING[1]).toBe(1);
    expect(EASE_SPRING[2]).toBe(0.3);
    expect(EASE_SPRING[3]).toBe(1);
  });

  it("EASE_STANDARD correspond au token --ease-standard (0.4,0,0.2,1)", () => {
    expect(EASE_STANDARD[0]).toBe(0.4);
    expect(EASE_STANDARD[1]).toBe(0);
    expect(EASE_STANDARD[2]).toBe(0.2);
    expect(EASE_STANDARD[3]).toBe(1);
  });
});
