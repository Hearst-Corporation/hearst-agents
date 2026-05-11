import { google } from "googleapis";
import { getGoogleAuth } from "./auth";

export interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
}

export interface SendEmailResult {
  id: string;
  threadId: string;
}

/**
 * Send an email via the user's Gmail account. Builds an RFC822 message,
 * encodes it base64url, and posts to gmail.users.messages.send.
 *
 * Requires the `gmail.send` (or `gmail.modify`) OAuth scope, which the
 * NextAuth Google provider requests up-front at sign-in.
 */
export async function sendEmail(
  userId: string,
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const auth = await getGoogleAuth(userId);
  const gmail = google.gmail({ version: "v1", auth });

  const headers = [
    `To: ${input.to}`,
    input.cc ? `Cc: ${input.cc}` : "",
    input.bcc ? `Bcc: ${input.bcc}` : "",
    `Subject: ${input.subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
  ].filter(Boolean);
  const raw = `${headers.join("\r\n")}\r\n\r\n${input.body}`;

  const encoded = Buffer.from(raw, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: encoded },
  });

  return {
    id: res.data.id ?? "",
    threadId: res.data.threadId ?? "",
  };
}

export interface EmailSummary {
  id: string;
  subject: string;
  sender: string;
  snippet: string;
  date: string;
  isRead: boolean;
}

interface GmailHeader {
  name?: string;
  value?: string;
}

function headerValue(headers: GmailHeader[], name: string): string {
  return headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

export async function getRecentEmails(userId: string, limit = 10): Promise<EmailSummary[]> {
  const auth = await getGoogleAuth(userId);
  const gmail = google.gmail({ version: "v1", auth });

  const list = await gmail.users.messages.list({
    userId: "me",
    maxResults: limit,
    q: "in:inbox",
  });

  const messageIds = list.data.messages ?? [];
  return Promise.all(
    messageIds.map(async (msg) => {
      const detail = await gmail.users.messages.get({
        userId: "me",
        id: msg.id!,
        format: "metadata",
        metadataHeaders: ["Subject", "From", "Date"],
      });
      const headers = (detail.data.payload?.headers ?? []) as GmailHeader[];
      return {
        id: detail.data.id ?? msg.id!,
        subject: headerValue(headers, "Subject") || "(sans sujet)",
        sender: headerValue(headers, "From"),
        snippet: detail.data.snippet ?? "",
        date: headerValue(headers, "Date"),
        isRead: !(detail.data.labelIds ?? []).includes("UNREAD"),
      };
    }),
  );
}

export interface EmailFull extends EmailSummary {
  body: string;
}

interface GmailPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
}

/**
 * Nettoie un HTML d'email avant de l'injecter dans le contexte LLM.
 * Supprime : scripts, styles, éléments cachés (display:none / visibility:hidden /
 * couleur blanche = technique d'injection invisible).
 * Cap 50 000 chars pour éviter les DoS tokeniser.
 */
function stripEmailHtml(html: string): string {
  return html
    // Supprimer blocs <style>
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    // Supprimer blocs <script>
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    // Supprimer éléments avec inline style display:none, visibility:hidden
    // ou couleur blanche (technique injection invisible)
    .replace(
      /<[^>]+style\s*=\s*["'][^"']*(?:display\s*:\s*none|visibility\s*:\s*hidden|color\s*:\s*white|color\s*:\s*#fff|color\s*:\s*#ffffff)[^"']*["'][^>]*>[\s\S]*?<\/[a-zA-Z]+>/gi,
      "",
    )
    // Strip balises HTML restantes
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 50_000);
}

function extractBody(payload: GmailPart | null | undefined): string {
  if (!payload) return "";
  if (payload.body?.data) {
    const raw = Buffer.from(payload.body.data, "base64url").toString("utf-8");
    return stripEmailHtml(raw);
  }
  if (payload.parts) {
    const textPart = payload.parts.find((p) => p.mimeType === "text/plain" && p.body?.data);
    if (textPart) {
      const raw = Buffer.from(textPart.body!.data!, "base64url").toString("utf-8");
      // Texte brut : strip uniquement les control chars et cap
      return raw.replace(/[\x00-\x08\x0B-\x1F\x7F]/g, "").slice(0, 50_000);
    }
    const htmlPart = payload.parts.find((p) => p.mimeType === "text/html" && p.body?.data);
    if (htmlPart && htmlPart.body?.data) {
      const html = Buffer.from(htmlPart.body.data, "base64url").toString("utf-8");
      return stripEmailHtml(html);
    }
  }
  return "";
}

export async function searchEmails(
  userId: string,
  query: string | undefined,
  limit = 10,
): Promise<EmailFull[]> {
  const auth = await getGoogleAuth(userId);
  const gmail = google.gmail({ version: "v1", auth });
  const q = query ? `in:inbox ${query}` : "in:inbox";

  const list = await gmail.users.messages.list({
    userId: "me",
    maxResults: limit,
    q,
  });

  const messageIds = list.data.messages ?? [];
  if (messageIds.length === 0) return [];

  return Promise.all(
    messageIds.map(async (msg) => {
      const detail = await gmail.users.messages.get({
        userId: "me",
        id: msg.id!,
        format: "full",
      });
      const headers = (detail.data.payload?.headers ?? []) as GmailHeader[];
      const body = extractBody(detail.data.payload as GmailPart | null | undefined);
      return {
        id: detail.data.id ?? msg.id!,
        subject: headerValue(headers, "Subject") || "(sans sujet)",
        sender: headerValue(headers, "From"),
        snippet: detail.data.snippet ?? "",
        date: headerValue(headers, "Date"),
        isRead: !(detail.data.labelIds ?? []).includes("UNREAD"),
        body: body.slice(0, 2000),
      };
    }),
  );
}
