/**
 * Tests unitaires — Approbation collaborative multi-acteur (Q3-D).
 *
 * Couverture :
 *  - requestApprovals : insertion N rows + génération token HMAC + envoi email
 *  - verifyApprovalToken : signature HMAC valide / malformée / expirée
 *  - recordVote : update vote + idempotence + rejet bloquant
 *  - Modes d'agrégation : "all" / "any" / "majority"
 *  - getApprovalState / hasActiveApprovalSession
 *
 * Stratégie : mock fluide léger autour de @supabase/supabase-js + mock email.
 */

import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Setup env vars AVANT l'import du module ────────────────────────────────
// Le secret HMAC doit faire ≥ 32 chars sinon le module désactive le signing.
process.env.MISSION_APPROVAL_SECRET = "x".repeat(48);
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key-for-tests";
process.env.NEXT_PUBLIC_APP_URL = "https://hearst.test";

// ── Mock email transactionnel ──────────────────────────────────────────────
const emailMocks = vi.hoisted(() => ({
  sendTransactionalEmail: vi.fn(),
  isTransactionalEmailEnabled: vi.fn(),
}));

vi.mock("@/lib/email/transactional", () => ({
  sendTransactionalEmail: emailMocks.sendTransactionalEmail,
  isTransactionalEmailEnabled: emailMocks.isTransactionalEmailEnabled,
}));

// ── Mock Supabase client (table mission_approvals) ─────────────────────────
//
// Implémentation in-memory : on stocke les rows insérés, on supporte
// .select().eq().maybeSingle() / .select().eq()  → array  / .insert()
// / .update().eq() / .order().limit().maybeSingle().
// Suffisant pour valider les flows de approvals.ts.

type Row = Record<string, unknown>;

const dbState = {
  rows: [] as Row[],
  insertError: null as { message: string } | null,
  updateError: null as { message: string } | null,
};

class QueryBuilder {
  private filters: Array<{ col: string; val: unknown; op: "eq" | "gt" }> = [];
  private orderCol: string | null = null;
  private orderAsc = true;
  private limitN: number | null = null;
  private updateValues: Row | null = null;
  private isUpdate = false;

  constructor(private rows: Row[]) {}

  select(_fields?: string) {
    return this;
  }

  eq(col: string, val: unknown) {
    this.filters.push({ col, val, op: "eq" });
    if (this.isUpdate && this.updateValues) {
      // Apply update on matching rows immediately
      for (const row of this.rows) {
        if (this.matches(row)) Object.assign(row, this.updateValues);
      }
      return Promise.resolve({
        data: null,
        error: dbState.updateError,
      });
    }
    return this;
  }

  gt(col: string, val: unknown) {
    this.filters.push({ col, val, op: "gt" });
    return this;
  }

  order(col: string, opts?: { ascending: boolean }) {
    this.orderCol = col;
    this.orderAsc = opts?.ascending ?? true;
    return this;
  }

  limit(n: number) {
    this.limitN = n;
    return this;
  }

  maybeSingle() {
    const filtered = this.applyAll();
    return Promise.resolve({
      data: filtered[0] ?? null,
      error: null,
    });
  }

  single() {
    const filtered = this.applyAll();
    return Promise.resolve({
      data: filtered[0] ?? null,
      error: filtered[0] ? null : { message: "not found" },
    });
  }

  // Thenable : permet `await sb.from(...).select().eq(...)` retournant tableau.
  then<T1, T2>(
    onfulfilled?: (val: { data: Row[] | null; error: unknown }) => T1 | PromiseLike<T1>,
    onrejected?: (reason: unknown) => T2 | PromiseLike<T2>,
  ): Promise<T1 | T2> {
    const filtered = this.applyAll();
    return Promise.resolve({ data: filtered, error: null }).then(onfulfilled, onrejected);
  }

  _setUpdate(values: Row) {
    this.isUpdate = true;
    this.updateValues = values;
  }

  private matches(row: Row): boolean {
    return this.filters.every((f) => {
      if (f.op === "eq") return row[f.col] === f.val;
      if (f.op === "gt") {
        const a = row[f.col];
        return typeof a === "string" && typeof f.val === "string" && a > f.val;
      }
      return true;
    });
  }

  private applyAll(): Row[] {
    let res = this.rows.filter((r) => this.matches(r));
    if (this.orderCol) {
      const col = this.orderCol;
      const asc = this.orderAsc;
      res = [...res].sort((a, b) => {
        const va = String(a[col] ?? "");
        const vb = String(b[col] ?? "");
        if (va === vb) return 0;
        return (va < vb ? -1 : 1) * (asc ? 1 : -1);
      });
    }
    if (this.limitN !== null) res = res.slice(0, this.limitN);
    return res;
  }
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: (_table: string) => ({
      insert: (rows: Row | Row[]) => {
        if (dbState.insertError) {
          return Promise.resolve({ data: null, error: dbState.insertError });
        }
        const arr = Array.isArray(rows) ? rows : [rows];
        for (const r of arr) {
          dbState.rows.push({
            ...r,
            created_at: r.created_at ?? new Date().toISOString(),
            comment: r.comment ?? null,
            voted_at: r.voted_at ?? null,
            run_id: r.run_id ?? null,
          });
        }
        return Promise.resolve({ data: arr, error: null });
      },
      select: (fields?: string) => new QueryBuilder(dbState.rows).select(fields),
      update: (values: Row) => {
        const qb = new QueryBuilder(dbState.rows);
        qb._setUpdate(values);
        return qb;
      },
    }),
  })),
}));

// ── Imports du module testé (après mocks) ──────────────────────────────────

import {
  APPROVAL_TTL_HOURS,
  buildApprovalUrl,
  getApprovalState,
  hasActiveApprovalSession,
  recordVote,
  requestApprovals,
  verifyApprovalToken,
} from "@/lib/missions/approvals";

// ── Helpers ────────────────────────────────────────────────────────────────

function resetDb(): void {
  dbState.rows = [];
  dbState.insertError = null;
  dbState.updateError = null;
}

const BASE_INPUT = {
  missionId: "mission-1",
  missionName: "Veille concurrentielle",
  missionInput: "Surveille les acquisitions du secteur fintech",
  tenantId: "tenant-1",
};

beforeEach(() => {
  resetDb();
  // Vitest config restoreMocks reset les implementations mais pas toujours
  // les call histories. On clear explicitement pour éviter de récupérer
  // les tokens d'emails envoyés par les tests précédents.
  emailMocks.sendTransactionalEmail.mockClear();
  emailMocks.isTransactionalEmailEnabled.mockClear();
  emailMocks.isTransactionalEmailEnabled.mockReturnValue(true);
  emailMocks.sendTransactionalEmail.mockResolvedValue({ ok: true, id: "msg-1" });
});

// ── Tests : requestApprovals ───────────────────────────────────────────────

describe("requestApprovals", () => {
  it("crée N rows pour N approvers et envoie N emails", async () => {
    const result = await requestApprovals({
      ...BASE_INPUT,
      approvers: ["alice@hearst.test", "bob@hearst.test", "carol@hearst.test"],
      mode: "all",
    });

    expect(result.ok).toBe(true);
    expect(result.sessionId).toBeDefined();
    expect(result.approvals).toHaveLength(3);
    expect(dbState.rows).toHaveLength(3);
    expect(emailMocks.sendTransactionalEmail).toHaveBeenCalledTimes(3);
  });

  it("toutes les rows ont le même session_id et le mode demandé", async () => {
    await requestApprovals({
      ...BASE_INPUT,
      approvers: ["a@h.test", "b@h.test"],
      mode: "majority",
    });
    const sids = new Set(dbState.rows.map((r) => r.session_id));
    expect(sids.size).toBe(1);
    expect(dbState.rows.every((r) => r.approval_mode === "majority")).toBe(true);
    expect(dbState.rows.every((r) => r.vote === "pending")).toBe(true);
  });

  it("ne stocke jamais le token raw — uniquement token_hash", async () => {
    await requestApprovals({
      ...BASE_INPUT,
      approvers: ["a@h.test"],
      mode: "all",
    });
    const row = dbState.rows[0];
    expect(typeof row.token_hash).toBe("string");
    expect((row.token_hash as string).length).toBe(64); // sha256 hex
    expect(row).not.toHaveProperty("token");
  });

  it("rejette si aucun approver", async () => {
    const result = await requestApprovals({
      ...BASE_INPUT,
      approvers: [],
      mode: "all",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("no_approvers");
  });

  it("ne fait pas échouer la session si l'email part en erreur", async () => {
    emailMocks.sendTransactionalEmail.mockResolvedValueOnce({
      ok: false,
      error: "smtp_down",
    });
    const result = await requestApprovals({
      ...BASE_INPUT,
      approvers: ["a@h.test", "b@h.test"],
      mode: "all",
    });
    expect(result.ok).toBe(true);
    expect(result.approvals?.[0].emailSent).toBe(false);
    expect(result.approvals?.[1].emailSent).toBe(true);
    // Les rows DB sont créées même si un email échoue.
    expect(dbState.rows).toHaveLength(2);
  });

  it("fait propager l'erreur d'insertion DB", async () => {
    dbState.insertError = { message: "duplicate key" };
    const result = await requestApprovals({
      ...BASE_INPUT,
      approvers: ["a@h.test"],
      mode: "all",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("duplicate key");
  });
});

// ── Tests : verifyApprovalToken ────────────────────────────────────────────

describe("verifyApprovalToken", () => {
  it("retourne ok=true pour un token signé valide", async () => {
    await requestApprovals({
      ...BASE_INPUT,
      approvers: ["alice@h.test"],
      mode: "all",
    });
    // On récupère le token brut via le call à sendTransactionalEmail
    // (l'URL contient le token).
    const call = emailMocks.sendTransactionalEmail.mock.calls[0][0];
    const text = call.text as string;
    const match = text.match(/\/public\/approvals\/([^?\s]+)/);
    expect(match).toBeTruthy();
    expect(match?.[1]).toBeDefined();
    const token = decodeURIComponent(match![1]);

    const result = verifyApprovalToken(token);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.mid).toBe("mission-1");
      expect(typeof result.payload.sid).toBe("string");
    }
  });

  it("retourne ok=false reason=malformed si format invalide", () => {
    expect(verifyApprovalToken("garbage").ok).toBe(false);
    const r = verifyApprovalToken("garbage");
    if (!r.ok) expect(r.reason).toBe("malformed");
  });

  it("retourne ok=false reason=bad_signature si signature corrompue", async () => {
    await requestApprovals({
      ...BASE_INPUT,
      approvers: ["a@h.test"],
      mode: "all",
    });
    const text = emailMocks.sendTransactionalEmail.mock.calls[0][0].text as string;
    const match = text.match(/\/public\/approvals\/([^?\s]+)/);
    expect(match?.[1]).toBeDefined();
    const token = decodeURIComponent(match![1]);
    // Tamper la signature : flip un char en milieu de la 2e partie.
    const [payload, sig] = token.split(".");
    const tampered = `${payload}.${sig.slice(0, -2)}AA`;
    const r = verifyApprovalToken(tampered);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(["bad_signature", "malformed"]).toContain(r.reason);
  });

  it("retourne ok=false reason=expired si exp dépassé", () => {
    // Construit un token avec exp dans le passé.
    const secret = process.env.MISSION_APPROVAL_SECRET!;
    const past = Math.floor(Date.now() / 1000) - 10;
    const payload = { sid: "s1", mid: "m1", iat: past - 100, exp: past };
    const b64 = (s: string | Buffer) =>
      (Buffer.isBuffer(s) ? s : Buffer.from(s))
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
    const payloadB64 = b64(JSON.stringify(payload));
    const sig = crypto.createHmac("sha256", secret).update(payloadB64).digest();
    const token = `${payloadB64}.${b64(sig)}`;

    const r = verifyApprovalToken(token);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("expired");
  });
});

// ── Tests : recordVote — modes d'agrégation ────────────────────────────────

async function setupSession(approvers: string[], mode: "all" | "any" | "majority") {
  const result = await requestApprovals({
    ...BASE_INPUT,
    approvers,
    mode,
  });
  expect(result.ok).toBe(true);
  const tokens = emailMocks.sendTransactionalEmail.mock.calls.map((c) => {
    const text = c[0].text as string;
    const match = text.match(/\/public\/approvals\/([^?\s]+)/);
    if (!match?.[1]) throw new Error("Token not found in email");
    return decodeURIComponent(match[1]);
  });
  return { tokens, sessionId: result.sessionId! };
}

describe("recordVote — mode all", () => {
  it("2/2 approuvent → isApproved=true", async () => {
    const { tokens } = await setupSession(["a@h.test", "b@h.test"], "all");
    const r1 = await recordVote(tokens[0], "approved");
    expect(r1.ok).toBe(true);
    expect(r1.sessionApproved).toBe(false); // 1/2 → pas encore
    const r2 = await recordVote(tokens[1], "approved");
    expect(r2.ok).toBe(true);
    expect(r2.sessionApproved).toBe(true);
  });

  it("1/2 approuvent + 1 pending → isApproved=false", async () => {
    const { tokens } = await setupSession(["a@h.test", "b@h.test"], "all");
    const r1 = await recordVote(tokens[0], "approved");
    expect(r1.sessionApproved).toBe(false);
    expect(r1.state?.pending).toBe(1);
    expect(r1.state?.approved).toBe(1);
  });
});

describe("recordVote — mode any", () => {
  it("1 approuve sur 3 → isApproved=true immédiatement", async () => {
    const { tokens } = await setupSession(["a@h.test", "b@h.test", "c@h.test"], "any");
    const r = await recordVote(tokens[0], "approved");
    expect(r.ok).toBe(true);
    expect(r.sessionApproved).toBe(true);
  });
});

describe("recordVote — mode majority", () => {
  it("2/3 approuvent → isApproved=true", async () => {
    const { tokens } = await setupSession(["a@h.test", "b@h.test", "c@h.test"], "majority");
    await recordVote(tokens[0], "approved");
    const r2 = await recordVote(tokens[1], "approved");
    expect(r2.sessionApproved).toBe(true);
  });

  it("1/3 approuve → isApproved=false", async () => {
    const { tokens } = await setupSession(["a@h.test", "b@h.test", "c@h.test"], "majority");
    const r = await recordVote(tokens[0], "approved");
    expect(r.sessionApproved).toBe(false);
    expect(r.state?.approved).toBe(1);
    expect(r.state?.pending).toBe(2);
  });
});

describe("recordVote — rejet bloquant", () => {
  it("1 rejected sur 3 → isRejected=true quel que soit le mode", async () => {
    const { tokens } = await setupSession(["a@h.test", "b@h.test", "c@h.test"], "all");
    const r = await recordVote(tokens[0], "rejected");
    expect(r.ok).toBe(true);
    expect(r.sessionRejected).toBe(true);
    expect(r.sessionApproved).toBe(false);
  });

  it("après un rejected, les votes suivants sont refusés (session_rejected)", async () => {
    const { tokens } = await setupSession(["a@h.test", "b@h.test"], "all");
    await recordVote(tokens[0], "rejected");
    const r = await recordVote(tokens[1], "approved");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("session_rejected");
  });
});

describe("recordVote — idempotence", () => {
  it("revote sur un row déjà voté → already_voted", async () => {
    const { tokens } = await setupSession(["a@h.test"], "any");
    await recordVote(tokens[0], "approved");
    const r = await recordVote(tokens[0], "approved");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("already_voted");
  });

  it("token expiré → ok=false reason=expired", async () => {
    const secret = process.env.MISSION_APPROVAL_SECRET!;
    const past = Math.floor(Date.now() / 1000) - 10;
    const payload = { sid: "s1", mid: "m1", iat: past - 100, exp: past };
    const b64 = (s: string | Buffer) =>
      (Buffer.isBuffer(s) ? s : Buffer.from(s))
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
    const payloadB64 = b64(JSON.stringify(payload));
    const sig = crypto.createHmac("sha256", secret).update(payloadB64).digest();
    const expiredToken = `${payloadB64}.${b64(sig)}`;

    const r = await recordVote(expiredToken, "approved");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("expired");
  });
});

// ── Tests : getApprovalState / hasActiveApprovalSession ────────────────────

describe("getApprovalState", () => {
  it("retourne null si aucune session pour la mission", async () => {
    const state = await getApprovalState("mission-inconnue");
    expect(state).toBeNull();
  });

  it("retourne l'état agrégé après plusieurs votes", async () => {
    const { tokens } = await setupSession(["a@h.test", "b@h.test", "c@h.test"], "all");
    await recordVote(tokens[0], "approved");
    const state = await getApprovalState("mission-1");
    expect(state).not.toBeNull();
    expect(state?.approved).toBe(1);
    expect(state?.pending).toBe(2);
    expect(state?.rejected).toBe(0);
    expect(state?.total).toBe(3);
    expect(state?.mode).toBe("all");
    expect(state?.votes).toHaveLength(3);
  });
});

describe("hasActiveApprovalSession", () => {
  it("retourne false sans session", async () => {
    const ok = await hasActiveApprovalSession("mission-vide");
    expect(ok).toBe(false);
  });

  it("retourne true tant qu'il reste des votes pending", async () => {
    await setupSession(["a@h.test", "b@h.test"], "all");
    const ok = await hasActiveApprovalSession("mission-1");
    expect(ok).toBe(true);
  });
});

// ── Tests : helpers utilitaires ────────────────────────────────────────────

describe("buildApprovalUrl", () => {
  it("construit une URL signée prête à publier", () => {
    const url = buildApprovalUrl("abc.def");
    expect(url).toBe("https://hearst.test/public/approvals/abc.def");
  });
});

describe("constants", () => {
  it("expose APPROVAL_TTL_HOURS = 168 (7 jours)", () => {
    expect(APPROVAL_TTL_HOURS).toBe(168);
  });
});
