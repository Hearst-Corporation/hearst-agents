/**
 * Tests unitaires pour detectFastPathAction (composio-fastpath.ts).
 *
 * Couverture :
 * - Cas positifs : les 5 services avec variantes FR/EN
 * - Guard écriture : retourne null sur tout intent de write
 * - Guard contexte : retourne null sur toute référence temporelle/conversationnelle
 * - No-match : retourne null sur message sans intent reconnu
 */

import { describe, expect, it } from "vitest";
import { detectFastPathAction } from "@/lib/engine/orchestrator/composio-fastpath";

// ── Gmail ────────────────────────────────────────────────────────────────────

describe("Gmail", () => {
  it('retourne GMAIL_FETCH_EMAILS sur "lis mes mails"', () => {
    const result = detectFastPathAction("lis mes mails");
    expect(result).not.toBeNull();
    expect(result?.slug).toBe("GMAIL_FETCH_EMAILS");
    expect(result?.args).toMatchObject({ max_results: 10 });
  });

  it('retourne GMAIL_FETCH_EMAILS sur "montre mon inbox"', () => {
    const result = detectFastPathAction("montre mon inbox");
    expect(result?.slug).toBe("GMAIL_FETCH_EMAILS");
  });

  it('retourne GMAIL_FETCH_EMAILS sur "check my emails"', () => {
    const result = detectFastPathAction("check my emails");
    expect(result?.slug).toBe("GMAIL_FETCH_EMAILS");
  });

  it('retourne GMAIL_FETCH_EMAILS sur "affiche mes courriels"', () => {
    const result = detectFastPathAction("affiche mes courriels");
    expect(result?.slug).toBe("GMAIL_FETCH_EMAILS");
  });

  it('"lis mes 3 derniers emails" → GMAIL_FETCH_EMAILS (dernier = le plus récent, pas une back-référence)', () => {
    const result = detectFastPathAction("lis mes 3 derniers emails");
    expect(result).not.toBeNull();
    expect(result?.slug).toBe("GMAIL_FETCH_EMAILS");
  });

  it('"montre mes derniers mails" → GMAIL_FETCH_EMAILS', () => {
    const result = detectFastPathAction("montre mes derniers mails");
    expect(result).not.toBeNull();
    expect(result?.slug).toBe("GMAIL_FETCH_EMAILS");
  });

  it('"show my last emails" → GMAIL_FETCH_EMAILS (last = le plus récent)', () => {
    const result = detectFastPathAction("show my last emails");
    expect(result).not.toBeNull();
    expect(result?.slug).toBe("GMAIL_FETCH_EMAILS");
  });
});

// ── Google Calendar ──────────────────────────────────────────────────────────

describe("Google Calendar", () => {
  it('retourne GOOGLECALENDAR_EVENTS_LIST sur "montre mon agenda de demain"', () => {
    const result = detectFastPathAction("montre mon agenda de demain");
    expect(result).not.toBeNull();
    expect(result?.slug).toBe("GOOGLECALENDAR_EVENTS_LIST");
    expect(result?.args).toMatchObject({ maxResults: 10 });
  });

  it('retourne GOOGLECALENDAR_EVENTS_LIST sur "mon calendrier de la semaine"', () => {
    const result = detectFastPathAction("mon calendrier de la semaine");
    expect(result?.slug).toBe("GOOGLECALENDAR_EVENTS_LIST");
  });

  it('retourne GOOGLECALENDAR_EVENTS_LIST sur "mes réunions today"', () => {
    const result = detectFastPathAction("mes réunions today");
    expect(result?.slug).toBe("GOOGLECALENDAR_EVENTS_LIST");
  });

  it('retourne GOOGLECALENDAR_EVENTS_LIST sur "show my calendar"', () => {
    const result = detectFastPathAction("show my calendar");
    expect(result?.slug).toBe("GOOGLECALENDAR_EVENTS_LIST");
  });
});

// ── Google Drive ─────────────────────────────────────────────────────────────

describe("Google Drive", () => {
  it('retourne GOOGLEDRIVE_LIST_FILES sur "liste mes fichiers sur drive"', () => {
    const result = detectFastPathAction("liste mes fichiers sur drive");
    expect(result).not.toBeNull();
    expect(result?.slug).toBe("GOOGLEDRIVE_LIST_FILES");
    expect(result?.args).toMatchObject({ page_size: 20 });
  });

  it('retourne GOOGLEDRIVE_LIST_FILES sur "montre mes documents"', () => {
    const result = detectFastPathAction("montre mes documents");
    expect(result?.slug).toBe("GOOGLEDRIVE_LIST_FILES");
  });

  it('retourne GOOGLEDRIVE_LIST_FILES sur "find my files"', () => {
    const result = detectFastPathAction("find my files");
    expect(result?.slug).toBe("GOOGLEDRIVE_LIST_FILES");
  });
});

// ── Slack ────────────────────────────────────────────────────────────────────

describe("Slack", () => {
  it('retourne SLACK_LIST_ALL_CHANNELS sur "slack canaux disponibles"', () => {
    const result = detectFastPathAction("slack canaux disponibles");
    expect(result).not.toBeNull();
    expect(result?.slug).toBe("SLACK_LIST_ALL_CHANNELS");
  });

  it('retourne SLACK_LIST_ALL_CHANNELS sur "slack channels"', () => {
    const result = detectFastPathAction("slack channels");
    expect(result?.slug).toBe("SLACK_LIST_ALL_CHANNELS");
  });

  it('retourne SLACK_LIST_ALL_CHANNELS sur "mes conversations slack"', () => {
    const result = detectFastPathAction("mes conversations slack");
    expect(result?.slug).toBe("SLACK_LIST_ALL_CHANNELS");
  });
});

// ── GitHub ───────────────────────────────────────────────────────────────────

describe("GitHub", () => {
  it('retourne GITHUB_FIND_REPOSITORIES sur "liste mes repos github"', () => {
    const result = detectFastPathAction("liste mes repos github");
    expect(result).not.toBeNull();
    expect(result?.slug).toBe("GITHUB_FIND_REPOSITORIES");
    expect(result?.args).toMatchObject({ limit: 20 });
  });

  it('retourne GITHUB_FIND_REPOSITORIES sur "montre mes repositories"', () => {
    const result = detectFastPathAction("montre mes repositories");
    expect(result?.slug).toBe("GITHUB_FIND_REPOSITORIES");
  });
});

// ── Guard écriture ───────────────────────────────────────────────────────────

describe("Guard écriture — doit retourner null", () => {
  it('"envoie un mail à X" → null', () => {
    expect(detectFastPathAction("envoie un mail à Pierre")).toBeNull();
  });

  it('"compose un email" → null', () => {
    expect(detectFastPathAction("compose un email pour l'équipe")).toBeNull();
  });

  it('"crée un événement calendrier" → null', () => {
    expect(detectFastPathAction("crée un événement calendrier demain")).toBeNull();
  });

  it('"supprime ce fichier drive" → null', () => {
    expect(detectFastPathAction("supprime ce fichier drive")).toBeNull();
  });

  it('"réponds au dernier mail" → null (write)', () => {
    expect(detectFastPathAction("réponds au dernier mail")).toBeNull();
  });

  it('"planifie une réunion" → null', () => {
    expect(detectFastPathAction("planifie une réunion lundi")).toBeNull();
  });

  it('"send a message on slack" → null', () => {
    expect(detectFastPathAction("send a message on slack")).toBeNull();
  });
});

// ── Guard contexte ───────────────────────────────────────────────────────────

describe("Guard contexte conversationnel — doit retourner null", () => {
  it('"résume le mail d\'hier" → null (hier = contexte)', () => {
    expect(detectFastPathAction("résume le mail d'hier")).toBeNull();
  });

  it('"montre le mail précédent" → null', () => {
    expect(detectFastPathAction("montre le mail précédent")).toBeNull();
  });

  it('"la réunion dont on a parlé" → null', () => {
    expect(detectFastPathAction("montre la réunion dont on a parlé")).toBeNull();
  });

  it('"yesterday emails" → null', () => {
    expect(detectFastPathAction("show me yesterday emails")).toBeNull();
  });

  it('"the last email I sent" → null (I sent = action passée, contexte)', () => {
    // "last" seul n'est plus un signal contexte — mais "I sent" l'est.
    expect(detectFastPathAction("find the last email I sent")).toBeNull();
  });

  it('"based on the last meeting" → null (based on + the meeting = contexte KG)', () => {
    expect(detectFastPathAction("based on the last meeting, show my calendar")).toBeNull();
  });

  it('"réponds au mail précédent" → null (write + précédent)', () => {
    // write guard (répond) ET contexte (précédent) — null dans les deux cas
    expect(detectFastPathAction("réponds au mail précédent")).toBeNull();
  });
});

// ── Google Drive — faux positifs "doc" ──────────────────────────────────────

describe("Google Drive — guard faux positifs \bdoc\b", () => {
  it('"montre la documentation" → null (documentation ≠ doc/document)', () => {
    expect(detectFastPathAction("montre la documentation")).toBeNull();
  });

  it('"appelle le docteur" → null (docteur ≠ doc)', () => {
    expect(detectFastPathAction("appelle le docteur")).toBeNull();
  });
});

// ── No-match ─────────────────────────────────────────────────────────────────

describe("No-match — doit retourner null", () => {
  it('"quelle heure est-il" → null', () => {
    expect(detectFastPathAction("quelle heure est-il")).toBeNull();
  });

  it('"bonjour" → null', () => {
    expect(detectFastPathAction("bonjour")).toBeNull();
  });

  it('"analyse mes performances" → null', () => {
    expect(detectFastPathAction("analyse mes performances")).toBeNull();
  });

  it("message vide → null", () => {
    expect(detectFastPathAction("")).toBeNull();
  });

  it('"quel est mon budget ?" → null', () => {
    expect(detectFastPathAction("quel est mon budget ?")).toBeNull();
  });
});
