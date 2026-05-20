/**
 * Approbation collaborative multi-acteur (Q3-D).
 *
 * Une mission scheduled peut définir une liste d'approvers (emails). Avant
 * chaque exécution, le scheduler crée une session d'approbation : N rows
 * dans `mission_approvals` (1 par approver) avec un token HMAC unique. Un
 * email part vers chaque approver avec un lien signé `/public/approvals/<token>`.
 *
 * Modes d'agrégation :
 *  - "all"      → tous les approvers doivent voter "approved" (unanimité, défaut)
 *  - "any"      → un seul "approved" suffit
 *  - "majority" → > 50% des approvers ont voté "approved"
 *
 * Un seul vote "rejected" termine la session (mission rejected).
 *
 * Pattern HMAC réutilisé depuis lib/reports/sharing/signed-url.ts :
 *   token = base64url(payload).hmac-base64url
 *   payload = { sid, mid, exp, iat }   // sid = approval row id, mid = mission id
 *   tokenHash = sha256(token).hex stocké en DB (jamais le token raw)
 */

import crypto, { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SECRET_MIN_LENGTH } from "@/lib/constants/security";
import { isTransactionalEmailEnabled, sendTransactionalEmail } from "@/lib/email/transactional";
import type { ApprovalMode } from "@/lib/engine/runtime/missions/types";
import { getServerSupabase } from "@/lib/platform/db/supabase";
import { escapeHtml } from "@/lib/utils/escape-html";

// ── Constantes ───────────────────────────────────────────────

/** TTL d'une session d'approbation : 7 jours. */
export const APPROVAL_TTL_HOURS = 168;

const HMAC_ALG = "sha256";
const TOKEN_SEPARATOR = ".";

// ── Types ────────────────────────────────────────────────────

export type ApprovalVote = "pending" | "approved" | "rejected";

export interface ApprovalRow {
  id: string;
  mission_id: string;
  run_id: string | null;
  tenant_id: string;
  approver_email: string;
  vote: ApprovalVote;
  comment: string | null;
  token_hash: string;
  approval_mode: ApprovalMode;
  session_id: string;
  expires_at: string;
  voted_at: string | null;
  created_at: string;
}

export interface RequestApprovalsInput {
  missionId: string;
  missionName: string;
  missionInput: string;
  tenantId: string;
  approvers: string[];
  mode: ApprovalMode;
  /** Optionnel — runId pré-créé. Si null, sera renseigné après vote. */
  runId?: string | null;
}

export interface RequestApprovalsResult {
  ok: boolean;
  sessionId?: string;
  approvals?: ReadonlyArray<{ id: string; email: string; emailSent: boolean }>;
  error?: string;
}

export interface RecordVoteResult {
  ok: boolean;
  reason?:
    | "malformed"
    | "bad_signature"
    | "expired"
    | "no_secret"
    | "not_found"
    | "already_voted"
    | "session_rejected"
    | "db_error";
  /** Aggrégat global de la session après ce vote (si succès). */
  state?: ApprovalSessionState;
  /** True si la session passe en "approved" (déclenche l'exécution). */
  sessionApproved?: boolean;
  /** True si la session passe en "rejected" (bloque définitivement). */
  sessionRejected?: boolean;
  /** Mission liée — utile au caller pour déclencher runMissionNow. */
  missionId?: string;
}

export interface ApprovalSessionState {
  sessionId: string;
  missionId: string;
  mode: ApprovalMode;
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  /** True si les votes en cours satisfont déjà `mode`. */
  isApproved: boolean;
  /** True si au moins un "rejected" → session bloquée. */
  isRejected: boolean;
  expiresAt: string;
  /** Liste publique safe (pas de tokens), pour affichage cockpit. */
  votes: ReadonlyArray<{
    email: string;
    vote: ApprovalVote;
    votedAt: string | null;
    comment: string | null;
  }>;
}

interface SignedTokenPayload {
  /** Approval row id (uuid). */
  sid: string;
  /** Mission id (uuid). */
  mid: string;
  /** Issued at (seconds). */
  iat: number;
  /** Expiration (seconds). */
  exp: number;
}

// ── Secret loader (fail-closed pour signature) ──────────────

let _warned = false;

/**
 * Réutilise REPORT_SHARING_SECRET (pattern existant côté reports) pour
 * éviter de multiplier les secrets HMAC. Si l'app a besoin d'un secret
 * dédié plus tard, on lira `MISSION_APPROVAL_SECRET` en priorité.
 */
function getApprovalSecret(): string | null {
  const secret = process.env.MISSION_APPROVAL_SECRET ?? process.env.REPORT_SHARING_SECRET ?? "";
  if (secret.length < SECRET_MIN_LENGTH) {
    if (!_warned) {
      console.warn(
        `[approvals] Secret HMAC absent ou < ${SECRET_MIN_LENGTH} chars — signing désactivé (fail-closed).`,
      );
      _warned = true;
    }
    return null;
  }
  return secret;
}

// ── DB client (service role — bypass RLS pour vote public) ──

function db(): SupabaseClient | null {
  return getServerSupabase();
}

// ── Encoding helpers ─────────────────────────────────────────

function base64url(buf: Buffer | string): string {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf, "utf8");
  return b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(s: string): Buffer {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(b64, "base64");
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

// ── Sign / Verify ────────────────────────────────────────────

interface SignTokenInput {
  approvalId: string;
  missionId: string;
  ttlHours?: number;
}

interface SignedToken {
  token: string;
  tokenHash: string;
  expiresAt: string;
}

function signApprovalToken(input: SignTokenInput): SignedToken | null {
  const secret = getApprovalSecret();
  if (!secret) return null;

  const ttlHours = input.ttlHours ?? APPROVAL_TTL_HOURS;
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + ttlHours * 3600;
  const payload: SignedTokenPayload = {
    sid: input.approvalId,
    mid: input.missionId,
    iat,
    exp,
  };

  const payloadB64 = base64url(JSON.stringify(payload));
  const sig = crypto.createHmac(HMAC_ALG, secret).update(payloadB64).digest();
  const token = `${payloadB64}${TOKEN_SEPARATOR}${base64url(sig)}`;

  return {
    token,
    tokenHash: hashToken(token),
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

export type VerifyApprovalTokenResult =
  | { ok: true; payload: SignedTokenPayload; tokenHash: string }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" | "no_secret" };

export function verifyApprovalToken(token: string): VerifyApprovalTokenResult {
  const secret = getApprovalSecret();
  if (!secret) return { ok: false, reason: "no_secret" };

  const parts = token.split(TOKEN_SEPARATOR);
  if (parts.length !== 2) return { ok: false, reason: "malformed" };
  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return { ok: false, reason: "malformed" };

  const expected = crypto.createHmac(HMAC_ALG, secret).update(payloadB64).digest();
  let provided: Buffer;
  try {
    provided = fromBase64url(sigB64);
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) {
    return { ok: false, reason: "bad_signature" };
  }

  let payload: SignedTokenPayload;
  try {
    const json = fromBase64url(payloadB64).toString("utf8");
    const parsed = JSON.parse(json) as Record<string, unknown>;
    if (
      typeof parsed.sid !== "string" ||
      typeof parsed.mid !== "string" ||
      typeof parsed.iat !== "number" ||
      typeof parsed.exp !== "number"
    ) {
      return { ok: false, reason: "malformed" };
    }
    payload = parsed as unknown as SignedTokenPayload;
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (payload.exp <= Math.floor(Date.now() / 1000)) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true, payload, tokenHash: hashToken(token) };
}

// ── URL builder ──────────────────────────────────────────────

export function buildApprovalUrl(token: string, baseUrl?: string): string {
  const base = baseUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "";
  const trimmed = base.replace(/\/+$/, "");
  return `${trimmed}/public/approvals/${encodeURIComponent(token)}`;
}

// ── Aggrégat de session ──────────────────────────────────────

function evaluateSession(rows: ReadonlyArray<ApprovalRow>): {
  isApproved: boolean;
  isRejected: boolean;
  pending: number;
  approved: number;
  rejected: number;
} {
  const total = rows.length;
  let approved = 0;
  let rejected = 0;
  let pending = 0;
  for (const r of rows) {
    if (r.vote === "approved") approved += 1;
    else if (r.vote === "rejected") rejected += 1;
    else pending += 1;
  }
  const mode = (rows[0]?.approval_mode ?? "all") as ApprovalMode;
  const isRejected = rejected > 0;
  let isApproved = false;
  if (!isRejected) {
    if (mode === "all") isApproved = approved === total && total > 0;
    else if (mode === "any") isApproved = approved >= 1;
    else if (mode === "majority") isApproved = approved * 2 > total;
  }
  return { isApproved, isRejected, pending, approved, rejected };
}

function rowsToState(rows: ReadonlyArray<ApprovalRow>): ApprovalSessionState | null {
  if (rows.length === 0) return null;
  const first = rows[0];
  const ev = evaluateSession(rows);
  return {
    sessionId: first.session_id,
    missionId: first.mission_id,
    mode: (first.approval_mode ?? "all") as ApprovalMode,
    total: rows.length,
    pending: ev.pending,
    approved: ev.approved,
    rejected: ev.rejected,
    isApproved: ev.isApproved,
    isRejected: ev.isRejected,
    expiresAt: first.expires_at,
    votes: rows.map((r) => ({
      email: r.approver_email,
      vote: r.vote,
      votedAt: r.voted_at,
      comment: r.comment,
    })),
  };
}

// ── Email rendering ──────────────────────────────────────────

function renderApprovalEmail(input: {
  missionName: string;
  missionInput: string;
  approverEmail: string;
  approveUrl: string;
  rejectUrl: string;
  expiresAt: string;
}): { subject: string; html: string; text: string } {
  const subject = `[Hearst OS] Approbation requise — ${input.missionName}`;
  const safeMission = escapeHtml(input.missionName);
  const safeInput = escapeHtml(input.missionInput).slice(0, 600);
  const expires = new Date(input.expiresAt).toLocaleString("fr-FR");

  const html = `<!DOCTYPE html>
<!-- Palette inline : sync app/globals.css :root (visionOS DS). Email clients : pas de var(), hex/rgba copiés des tokens. -->
<html lang="fr">
<head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;background:#000000;color:rgba(255,255,255,0.88);margin:0;padding:32px;">
  <div style="max-width:560px;margin:0 auto;background:#121212;border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:32px;">
    <h1 style="font-size:20px;font-weight:500;letter-spacing:-0.01em;margin:0 0 8px 0;color:#ffffff;">Approbation requise</h1>
    <p style="font-size:14px;color:rgba(255,255,255,0.65);margin:0 0 24px 0;">Une mission Hearst OS attend votre validation avant exécution.</p>

    <div style="border-top:1px solid rgba(255,255,255,0.06);border-bottom:1px solid rgba(255,255,255,0.06);padding:16px 0;margin:24px 0;">
      <p style="font-size:12px;color:rgba(255,255,255,0.45);margin:0 0 4px 0;text-transform:uppercase;letter-spacing:0.08em;">Mission</p>
      <p style="font-size:16px;color:#ffffff;margin:0 0 16px 0;font-weight:500;">${safeMission}</p>
      <p style="font-size:12px;color:rgba(255,255,255,0.45);margin:0 0 4px 0;text-transform:uppercase;letter-spacing:0.08em;">Instructions</p>
      <p style="font-size:13px;color:rgba(255,255,255,0.65);margin:0;line-height:1.6;white-space:pre-wrap;">${safeInput}</p>
    </div>

    <div style="text-align:center;margin:32px 0 24px 0;">
      <a href="${input.approveUrl}" style="display:inline-block;padding:12px 24px;background:#4a8b86;color:#000000;text-decoration:none;border-radius:9999px;font-weight:500;font-size:14px;margin:0 8px 8px 0;">Approuver</a>
      <a href="${input.rejectUrl}" style="display:inline-block;padding:12px 24px;background:transparent;color:rgba(255,255,255,0.88);text-decoration:none;border:1px solid rgba(255,255,255,0.06);border-radius:9999px;font-weight:500;font-size:14px;margin:0 8px 8px 0;">Rejeter</a>
    </div>

    <p style="font-size:12px;color:rgba(255,255,255,0.45);margin:24px 0 0 0;line-height:1.6;">
      Lien personnel — ne pas transférer.<br>
      Valide jusqu'au ${escapeHtml(expires)}.
    </p>
  </div>
  <p style="text-align:center;font-size:11px;color:rgba(255,255,255,0.42);margin:24px 0 0 0;">© Hearst OS · Approbation collaborative</p>
</body>
</html>`;

  const text = [
    `Approbation requise — ${input.missionName}`,
    "",
    `Mission : ${input.missionName}`,
    `Instructions : ${input.missionInput.slice(0, 600)}`,
    "",
    `Approuver : ${input.approveUrl}`,
    `Rejeter   : ${input.rejectUrl}`,
    "",
    `Valide jusqu'au ${expires}.`,
    `Lien personnel — ne pas transférer.`,
  ].join("\n");

  return { subject, html, text };
}

// ── Public API ───────────────────────────────────────────────

/**
 * Vérifie si une session d'approbation est déjà active pour une mission.
 * Une session est "active" si au moins un row est `vote = pending` et
 * non expiré. Utilisé par le scheduler pour skipper les ticks pendant
 * que les votes sont collectés.
 */
export async function hasActiveApprovalSession(missionId: string): Promise<boolean> {
  const sb = db();
  if (!sb) return false;
  const { data, error } = await sb
    .from("mission_approvals")
    .select("id, vote, expires_at")
    .eq("mission_id", missionId)
    .eq("vote", "pending")
    .gt("expires_at", new Date().toISOString())
    .limit(1);
  if (error) {
    console.warn("[approvals] hasActiveApprovalSession error:", error.message);
    return false;
  }
  return (data?.length ?? 0) > 0;
}

/**
 * Crée une session d'approbation : N rows DB + N emails.
 * Retourne `ok: false` si la DB est indispo ou aucun email approver fourni.
 * Les échecs d'envoi email ne font PAS échouer l'opération (la session
 * est créée, le caller peut compléter via dashboard).
 */
export async function requestApprovals(
  input: RequestApprovalsInput,
): Promise<RequestApprovalsResult> {
  const sb = db();
  if (!sb) return { ok: false, error: "no_supabase_client" };
  if (!input.approvers || input.approvers.length === 0) {
    return { ok: false, error: "no_approvers" };
  }
  if (!getApprovalSecret()) {
    return { ok: false, error: "no_secret" };
  }

  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + APPROVAL_TTL_HOURS * 3600_000).toISOString();
  const mode = input.mode ?? "all";

  // Pré-génère tous les rows + tokens. On signe APRÈS avoir l'id Supabase
  // pour que le payload contienne le bon `sid` ; on insère par batch en
  // 2 phases : insert (sans token_hash placeholder), update token_hash.
  // Plus simple : on génère un id côté client (uuid) et on insère avec
  // token_hash final dans la même opération.
  const rows: Array<{
    id: string;
    email: string;
    token: string;
    tokenHash: string;
  }> = [];

  for (const email of input.approvers) {
    const id = randomUUID();
    const signed = signApprovalToken({ approvalId: id, missionId: input.missionId });
    if (!signed) {
      return { ok: false, error: "no_secret" };
    }
    rows.push({ id, email, token: signed.token, tokenHash: signed.tokenHash });
  }

  const dbRows = rows.map((r) => ({
    id: r.id,
    mission_id: input.missionId,
    run_id: input.runId ?? null,
    tenant_id: input.tenantId,
    approver_email: r.email,
    vote: "pending" as const,
    token_hash: r.tokenHash,
    approval_mode: mode,
    session_id: sessionId,
    expires_at: expiresAt,
  }));

  const { error: insertErr } = await sb.from("mission_approvals").insert(dbRows);
  if (insertErr) {
    console.error("[approvals] insert error:", insertErr.message);
    return { ok: false, error: insertErr.message };
  }

  // Envoi des emails (fire-and-forget par approver — un échec n'invalide
  // pas les autres). On collecte le statut pour audit côté caller.
  const emailEnabled = isTransactionalEmailEnabled();
  const sendResults = await Promise.all(
    rows.map(async (r) => {
      const approveUrl = `${buildApprovalUrl(r.token)}?action=approve`;
      const rejectUrl = `${buildApprovalUrl(r.token)}?action=reject`;
      const { subject, html, text } = renderApprovalEmail({
        missionName: input.missionName,
        missionInput: input.missionInput,
        approverEmail: r.email,
        approveUrl,
        rejectUrl,
        expiresAt,
      });

      if (!emailEnabled) {
        // Stub mode — on logge le lien pour debug local.
        console.warn(
          `[approvals] RESEND_API_KEY absente — email non envoyé. Lien manuel pour ${r.email} : ${buildApprovalUrl(r.token)}`,
        );
        return { id: r.id, email: r.email, emailSent: false };
      }

      const result = await sendTransactionalEmail({
        to: r.email,
        subject,
        html,
        text,
      });
      return { id: r.id, email: r.email, emailSent: result.ok };
    }),
  );

  return {
    ok: true,
    sessionId,
    approvals: sendResults,
  };
}

/**
 * Enregistre un vote depuis le lien public.
 * Idempotent : un revote sur le même row est rejeté ("already_voted").
 *
 * Si le vote bascule la session en `isApproved` ou `isRejected`, le
 * caller doit déclencher l'exécution de la mission (pour `isApproved`)
 * ou marquer la mission `lastRunStatus: "failed"` avec erreur explicite.
 */
export async function recordVote(
  token: string,
  vote: "approved" | "rejected",
  comment?: string,
): Promise<RecordVoteResult> {
  const v = verifyApprovalToken(token);
  if (!v.ok) return { ok: false, reason: v.reason };

  const sb = db();
  if (!sb) return { ok: false, reason: "db_error" };

  // Lookup par tokenHash (jamais le token raw stocké en DB)
  const { data: row, error: findErr } = await sb
    .from("mission_approvals")
    .select("*")
    .eq("token_hash", v.tokenHash)
    .maybeSingle();

  if (findErr) {
    console.error("[approvals] recordVote lookup error:", findErr.message);
    return { ok: false, reason: "db_error" };
  }
  if (!row) return { ok: false, reason: "not_found" };

  const r = row as ApprovalRow;
  if (r.vote !== "pending") {
    return { ok: false, reason: "already_voted" };
  }

  // Vérifier qu'aucun row de la session n'est déjà rejected
  const { data: sessionRows } = await sb
    .from("mission_approvals")
    .select("*")
    .eq("session_id", r.session_id);
  const all = (sessionRows ?? []) as ApprovalRow[];
  if (all.some((x) => x.vote === "rejected")) {
    return { ok: false, reason: "session_rejected" };
  }

  // Update le vote
  const { error: updateErr } = await sb
    .from("mission_approvals")
    .update({
      vote,
      comment: comment ?? null,
      voted_at: new Date().toISOString(),
    })
    .eq("id", r.id);

  if (updateErr) {
    console.error("[approvals] recordVote update error:", updateErr.message);
    return { ok: false, reason: "db_error" };
  }

  // Recalcule l'état après update
  const updated = all.map((x) =>
    x.id === r.id
      ? { ...x, vote, comment: comment ?? null, voted_at: new Date().toISOString() }
      : x,
  );
  const state = rowsToState(updated);

  return {
    ok: true,
    state: state ?? undefined,
    sessionApproved: state?.isApproved ?? false,
    sessionRejected: state?.isRejected ?? false,
    missionId: r.mission_id,
  };
}

/**
 * Renvoie l'état agrégé de la session active pour une mission, ou `null`
 * si aucune session n'existe. Utilisé par l'UI cockpit pour afficher
 * "En attente — N/M votes".
 */
export async function getApprovalState(missionId: string): Promise<ApprovalSessionState | null> {
  const sb = db();
  if (!sb) return null;

  // Récupère la session la plus récente (par created_at)
  const { data: latest } = await sb
    .from("mission_approvals")
    .select("session_id")
    .eq("mission_id", missionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latest?.session_id) return null;

  const { data: rows, error } = await sb
    .from("mission_approvals")
    .select("*")
    .eq("session_id", latest.session_id);

  if (error || !rows) return null;
  return rowsToState(rows as ApprovalRow[]);
}

/**
 * Lookup d'un row par tokenHash — utilisé par la page publique pour
 * afficher le contexte mission avant le vote.
 */
export async function getApprovalByTokenHash(tokenHash: string): Promise<ApprovalRow | null> {
  const sb = db();
  if (!sb) return null;
  const { data, error } = await sb
    .from("mission_approvals")
    .select("*")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (error || !data) return null;
  return data as ApprovalRow;
}
