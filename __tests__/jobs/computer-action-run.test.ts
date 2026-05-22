/**
 * Tests unitaires pour computer-action-run (HITL status mapping).
 *
 * On teste la fonction pure `mapActionResultToRunStatus` extraite du handler
 * Inngest — approche préférable à tester le handler complet (lourd à wirer).
 *
 * Couverture :
 *   - completed  → runStatus "completed", pas de notif
 *   - confirmation_required → runStatus "awaiting_approval", notif émise
 *   - blocked    → runStatus "awaiting_clarification", notif émise
 *   - {ok:false} → runStatus "failed", pas de notif
 */

import { describe, expect, it } from "vitest";
import { mapActionResultToRunStatus } from "@/lib/jobs/inngest/functions/computer-action-run";

describe("mapActionResultToRunStatus", () => {
  it("completed → runStatus 'completed', needsHuman false, pas de notif", () => {
    const result = mapActionResultToRunStatus({ ok: true, status: "completed", reply: "done" });
    expect(result.runStatus).toBe("completed");
    expect(result.needsHuman).toBe(false);
    expect(result.notifyTitle).toBeNull();
    expect(result.errorMsg).toBeUndefined();
  });

  it("confirmation_required → runStatus 'awaiting_approval', needsHuman true, notif émise", () => {
    const result = mapActionResultToRunStatus({
      ok: true,
      status: "confirmation_required",
      reply: "Veuillez confirmer la suppression du compte.",
    });
    expect(result.runStatus).toBe("awaiting_approval");
    expect(result.needsHuman).toBe(true);
    expect(result.notifyTitle).toBe("Action computer-use : confirmation requise");
    expect(result.notifyBody).toBe("Veuillez confirmer la suppression du compte.");
    expect(result.errorMsg).toBeUndefined();
  });

  it("confirmation_required sans reply → notifyBody fallback non vide", () => {
    const result = mapActionResultToRunStatus({ ok: true, status: "confirmation_required" });
    expect(result.runStatus).toBe("awaiting_approval");
    expect(result.notifyBody.length).toBeGreaterThan(0);
  });

  it("blocked → runStatus 'awaiting_clarification', needsHuman true, notif émise", () => {
    const result = mapActionResultToRunStatus({
      ok: true,
      status: "blocked",
      reply: "CAPTCHA détecté — intervention manuelle requise.",
    });
    expect(result.runStatus).toBe("awaiting_clarification");
    expect(result.needsHuman).toBe(true);
    expect(result.notifyTitle).toBe("Action bloquée — intervention requise");
    expect(result.notifyBody).toBe("CAPTCHA détecté — intervention manuelle requise.");
    expect(result.errorMsg).toBeUndefined();
  });

  it("blocked sans reply → notifyBody fallback non vide", () => {
    const result = mapActionResultToRunStatus({ ok: true, status: "blocked" });
    expect(result.runStatus).toBe("awaiting_clarification");
    expect(result.notifyBody.length).toBeGreaterThan(0);
  });

  it("{ok:false} → runStatus 'failed', needsHuman false, pas de notif", () => {
    const result = mapActionResultToRunStatus({
      ok: false,
      error: "timeout après 300s",
    });
    expect(result.runStatus).toBe("failed");
    expect(result.needsHuman).toBe(false);
    expect(result.notifyTitle).toBeNull();
    expect(result.errorMsg).toBe("timeout après 300s");
  });

  it("{ok:false} sans error → errorMsg fallback non vide", () => {
    const result = mapActionResultToRunStatus({ ok: false });
    expect(result.runStatus).toBe("failed");
    expect(result.errorMsg).toBeTruthy();
  });
});
