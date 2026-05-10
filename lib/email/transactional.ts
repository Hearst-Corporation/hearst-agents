/**
 * Email transactionnel — wrapper léger autour de Resend.
 *
 * Fail-soft : si `RESEND_API_KEY` est absente, on logge structurellement
 * et on retourne `{ ok: false, error: "resend_not_configured" }` au lieu
 * de throw — le flow d'approbation continue (les votes peuvent être
 * collectés via /admin si l'email n'a pas pu partir).
 *
 * Pas de retry interne ici : la responsabilité d'éventuels retries reste
 * côté caller (cf. lib/missions/approvals.ts qui logge mais n'échoue pas).
 */

import { Resend } from "resend";

const DEFAULT_FROM = process.env.RESEND_FROM_EMAIL ?? "Hearst OS <noreply@hearst.app>";

export interface TransactionalEmail {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

export interface TransactionalEmailResult {
  ok: boolean;
  id?: string;
  error?: string;
}

let _resendClient: Resend | null = null;

function getClient(): Resend | null {
  if (_resendClient) return _resendClient;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  _resendClient = new Resend(apiKey);
  return _resendClient;
}

export function isTransactionalEmailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendTransactionalEmail(
  msg: TransactionalEmail,
): Promise<TransactionalEmailResult> {
  if (!msg.html && !msg.text) {
    return { ok: false, error: "missing_body" };
  }

  const client = getClient();
  if (!client) {
    // Stub mode : on logge structurellement pour visibilité dev sans
    // bloquer le flow. Un agent d'ops peut relier les tokens à un
    // dashboard /admin/approvals si Resend n'est pas configuré.
    console.warn("[email/transactional] RESEND_API_KEY absente — email NON envoyé", {
      to: msg.to,
      subject: msg.subject,
    });
    return { ok: false, error: "resend_not_configured" };
  }

  try {
    const { data, error } = await client.emails.send({
      from: msg.from ?? DEFAULT_FROM,
      to: msg.to,
      subject: msg.subject,
      html: msg.html ?? "",
      text: msg.text,
      replyTo: msg.replyTo,
    });
    if (error) {
      console.error("[email/transactional] send error:", error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true, id: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    console.error("[email/transactional] send exception:", message);
    return { ok: false, error: message };
  }
}
