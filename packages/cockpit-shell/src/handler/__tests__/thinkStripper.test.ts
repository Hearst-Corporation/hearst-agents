/**
 * thinkStripper.test.ts
 *
 * Tests unitaires pour makeThinkStripper.
 * Runner : Node.js natif (node:test) — aucune dépendance externe requise.
 *
 * Exécution :
 *   npx tsx src/handler/__tests__/thinkStripper.test.ts
 * ou via ts-node / vitest si ajouté plus tard.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { makeThinkStripper } from "../createCockpitChatHandler.js";

describe("makeThinkStripper", () => {
  // ---------------------------------------------------------------------------
  // Test 1 : chunk complet avec think
  // ---------------------------------------------------------------------------
  it("filtre un bloc <think> complet dans un seul chunk", () => {
    const feed = makeThinkStripper();
    const result = feed("<think>raisonnement privé</think>réponse visible");
    assert.equal(result, "réponse visible");
  });

  // ---------------------------------------------------------------------------
  // Test 2 : think fragmenté sur 2 chunks
  // ---------------------------------------------------------------------------
  it("filtre un bloc <think> fragmenté sur 2 chunks", () => {
    const feed = makeThinkStripper();

    const out1 = feed("<think>raison");
    assert.equal(out1, "", "chunk 1 doit être vide (inside think)");

    const out2 = feed("nement</think>réponse");
    assert.equal(out2, "réponse", "chunk 2 doit retourner uniquement la partie visible");
  });

  // ---------------------------------------------------------------------------
  // Test 3 : pas de think (passthrough)
  // ---------------------------------------------------------------------------
  it("laisse passer du texte sans balise think", () => {
    const feed = makeThinkStripper();
    const result = feed("texte normal");
    assert.equal(result, "texte normal");
  });

  // ---------------------------------------------------------------------------
  // Test 4 (bonus) : think ouvert sans fermeture (edge case fin de stream)
  // ---------------------------------------------------------------------------
  it("retient le contenu après <think> non fermé", () => {
    const feed = makeThinkStripper();
    // "avant" doit passer, le contenu après <think> doit être retenu (pas émis).
    const result = feed("avant<think>incomplet");
    assert.equal(result, "avant", "le texte avant <think> doit être émis");
  });

  // ---------------------------------------------------------------------------
  // Test 5 : plusieurs blocs think dans un seul chunk
  // ---------------------------------------------------------------------------
  it("filtre plusieurs blocs <think> dans un seul chunk", () => {
    const feed = makeThinkStripper();
    const result = feed("début<think>a</think>milieu<think>b</think>fin");
    assert.equal(result, "débutmilieufin");
  });

  // ---------------------------------------------------------------------------
  // Test 6 : texte vide (flush final)
  // ---------------------------------------------------------------------------
  it("retourne vide pour un flush final sur texte vide", () => {
    const feed = makeThinkStripper();
    feed("bonjour");
    const tail = feed("");
    // "" est un flush — buffer ne contient pas de suffixe think, donc on retourne "".
    assert.equal(tail, "");
  });
});
