/**
 * Page publique d'un report partagé.
 *
 * Server component — pas de SessionProvider.
 * Récupère côté serveur le payload via le token et l'affiche en lecture seule.
 * Le robots noindex est porté par les metadata (Next 15 app router).
 *
 * Vitrine produit branded Hearst OS : header sticky + rapport + CTA PLG +
 * footer minimaliste. Mode dark only, langage visuel "silent luxury".
 */

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import {
  verifyToken,
  hashToken,
} from "@/lib/reports/sharing/signed-url";
import {
  findShareByTokenHash,
  incrementShareViewCount,
} from "@/lib/reports/sharing/store";
import { getServerSupabase } from "@/lib/platform/db/supabase";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ token: string }>;
}

interface PublicReportData {
  status: "ok";
  title: string;
  summary: string | null;
  createdAt: string;
  expiresAt: string;
  narration: string | null;
  blocks: Array<{ id: string; type: string; label?: string }>;
}

interface PublicReportError {
  status: "error";
  code: string;
}

async function loadPublicReport(
  token: string,
): Promise<PublicReportData | PublicReportError> {
  const verify = verifyToken(token);
  if (!verify.ok) {
    return { status: "error", code: verify.reason };
  }
  const share = await findShareByTokenHash(hashToken(token));
  if (!share) return { status: "error", code: "not_found" };
  if (share.revoked_at) return { status: "error", code: "revoked" };

  const sb = getServerSupabase();
  if (!sb) return { status: "error", code: "storage_unavailable" };
  const { data: asset } = await sb
    .from("assets")
    .select("title, summary, content_ref, created_at")
    .eq("id", share.asset_id)
    .maybeSingle();
  if (!asset) return { status: "error", code: "asset_not_found" };

  void incrementShareViewCount(share.id);

  let narration: string | null = null;
  let blocks: Array<{ id: string; type: string; label?: string }> = [];
  if (
    typeof asset.content_ref === "string" &&
    asset.content_ref.trim().startsWith("{")
  ) {
    try {
      const parsed = JSON.parse(asset.content_ref) as Record<string, unknown>;
      const candidatePayload =
        (parsed.payload as Record<string, unknown> | undefined) ??
        (parsed.__reportPayload === true
          ? (parsed as Record<string, unknown>)
          : undefined);
      if (candidatePayload && Array.isArray(candidatePayload.blocks)) {
        blocks = (candidatePayload.blocks as Array<Record<string, unknown>>).map(
          (b) => ({
            id: String(b.id ?? "?"),
            type: String(b.type ?? "?"),
            label: typeof b.label === "string" ? b.label : undefined,
          }),
        );
      }
      if (typeof parsed.narration === "string") narration = parsed.narration;
    } catch {
      // ignore
    }
  }

  return {
    status: "ok",
    title: asset.title ?? "Rapport",
    summary: asset.summary ?? null,
    createdAt: String(asset.created_at ?? ""),
    expiresAt: share.expires_at,
    narration,
    blocks,
  };
}

/**
 * Métadonnées dynamiques : title + description extraite du rapport.
 * noindex / nofollow pour rester invisible aux moteurs (lien privé HMAC).
 */
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { token } = await params;
  const result = await loadPublicReport(token);

  if (result.status === "error") {
    return {
      robots: { index: false, follow: false, nocache: true },
      title: "Lien indisponible — Hearst OS",
    };
  }

  const description = (result.summary ?? result.narration ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 160);

  return {
    robots: { index: false, follow: false, nocache: true },
    title: `Rapport ${result.title} — Hearst OS`,
    description: description || "Rapport généré par Hearst OS.",
    openGraph: {
      title: `Rapport ${result.title} — Hearst OS`,
      description: description || "Rapport généré par Hearst OS.",
      type: "article",
      siteName: "Hearst OS",
    },
  };
}

/**
 * Header branded — sticky top, logo + tagline discrète.
 * Le logo /hearst-logo.svg est intouchable (cf. feedback_rules).
 */
function BrandedHeader() {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "var(--space-3) var(--space-6)",
        background: "var(--surface-1)",
        borderBottom: "1px solid var(--border-subtle)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      <Link
        href="https://hearstcorporation.io"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "var(--space-2)",
          textDecoration: "none",
          color: "var(--text)",
        }}
      >
        <Image
          src="/hearst-logo.svg"
          alt="Hearst OS"
          width={64}
          height={16}
          style={{ height: "16px", width: "auto" }}
          priority
        />
      </Link>
      <span
        className="t-11"
        style={{ color: "var(--text-faint)", fontWeight: 300 }}
      >
        Rapport partagé via Hearst OS
      </span>
    </header>
  );
}

/**
 * Footer CTA premium — vitrine PLG.
 * Padding généreux, accent teal sourd, sub-copy "no friction".
 */
function CtaFooter() {
  return (
    <section
      style={{
        marginTop: "var(--space-24)",
        padding: "var(--space-12) var(--space-6)",
        background: "var(--surface-1)",
        borderTop: "1px solid var(--border-subtle)",
      }}
    >
      <div
        style={{
          maxWidth: "720px",
          margin: "0 auto",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--space-5)",
          animation: "publicReportFadeIn 600ms var(--ease-out, ease-out) both",
        }}
      >
        <h2
          className="t-28"
          style={{
            fontWeight: 300,
            color: "var(--text)",
            letterSpacing: "-0.02em",
            margin: 0,
          }}
        >
          Pilotez vos opérations avec l&apos;IA.
        </h2>
        <p
          className="t-15"
          style={{
            color: "var(--text-soft)",
            margin: 0,
            maxWidth: "560px",
            lineHeight: 1.55,
          }}
        >
          Hearst OS génère des rapports comme celui-ci, automatiquement et en
          continu.
        </p>
        <Link
          href="https://hearstcorporation.io"
          className="t-13"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--space-2)",
            padding: "var(--space-3) var(--space-6)",
            background: "var(--accent-teal)",
            color: "var(--text-on-accent, var(--text))",
            textDecoration: "none",
            borderRadius: "var(--radius-pill, 9999px)",
            fontWeight: 500,
            marginTop: "var(--space-2)",
            transition: "background 200ms ease, transform 200ms ease",
          }}
        >
          Créer mon cockpit →
        </Link>
        <p
          className="t-9"
          style={{
            color: "var(--text-faint)",
            margin: 0,
            marginTop: "var(--space-1)",
          }}
        >
          Gratuit · Aucune carte requise
        </p>
      </div>
    </section>
  );
}

/**
 * Footer minimaliste tout en bas — copyright + IA disclosure.
 */
function MinimalFooter() {
  return (
    <footer
      style={{
        padding: "var(--space-6)",
        textAlign: "center",
        borderTop: "1px solid var(--border-subtle)",
      }}
    >
      <p
        className="t-9"
        style={{
          color: "var(--text-faint)",
          fontWeight: 300,
          margin: 0,
        }}
      >
        © 2026 Hearst Corporation · Rapport généré par IA ·{" "}
        <Link
          href="https://hearstcorporation.io/privacy"
          style={{ color: "var(--text-faint)", textDecoration: "underline" }}
        >
          Politique de confidentialité
        </Link>
      </p>
    </footer>
  );
}

export default async function PublicReportPage({ params }: PageProps) {
  // touche les headers pour forcer le rendering dynamique côté Next 15
  await headers();
  const { token } = await params;
  const result = await loadPublicReport(token);

  if (result.status === "error") {
    const errorMessages: Record<string, string> = {
      revoked: "Ce lien a été révoqué.",
      not_found: "Ce lien n'est plus valide.",
      storage_unavailable: "Stockage temporairement indisponible.",
      asset_not_found: "Le rapport associé est introuvable.",
      expired: "Ce lien a expiré.",
    };
    const message =
      errorMessages[result.code] ?? "Ce lien de partage n'est plus valide.";
    return (
      <>
        <style>{publicReportKeyframes}</style>
        <BrandedHeader />
        <main
          style={{
            padding: "var(--space-12) var(--space-6)",
            maxWidth: "720px",
            margin: "0 auto",
            color: "var(--text)",
            minHeight: "60vh",
          }}
        >
          <h1
            className="t-28"
            style={{ fontWeight: 300, letterSpacing: "-0.02em" }}
          >
            Lien indisponible
          </h1>
          <p
            className="t-13"
            style={{ color: "var(--text-soft)", marginTop: "var(--space-3)" }}
          >
            {message}
          </p>
        </main>
        <CtaFooter />
        <MinimalFooter />
      </>
    );
  }

  return (
    <>
      <style>{publicReportKeyframes}</style>
      <BrandedHeader />
      <main
        style={{
          padding: "var(--space-12) var(--space-6)",
          maxWidth: "880px",
          margin: "0 auto",
          color: "var(--text)",
        }}
      >
        <header style={{ marginBottom: "var(--space-10)" }}>
          <h1
            className="t-34"
            style={{
              fontWeight: 400,
              letterSpacing: "-0.02em",
              color: "var(--text)",
              margin: 0,
            }}
          >
            {result.title}
          </h1>
          {result.summary ? (
            <p
              className="t-15"
              style={{
                color: "var(--text-soft)",
                marginTop: "var(--space-4)",
                lineHeight: 1.6,
              }}
            >
              {result.summary}
            </p>
          ) : null}
          <p
            className="t-9"
            style={{
              color: "var(--text-faint)",
              marginTop: "var(--space-4)",
            }}
          >
            Lien valide jusqu&apos;au{" "}
            {new Date(result.expiresAt).toLocaleString("fr-FR")}
          </p>
        </header>

        {result.narration ? (
          <section style={{ marginBottom: "var(--space-10)" }}>
            <h2
              className="halo-mono-label"
              style={{ marginBottom: "var(--space-3)" }}
            >
              Narration
            </h2>
            <p
              className="t-13"
              style={{
                whiteSpace: "pre-wrap",
                color: "var(--text-soft)",
                lineHeight: 1.7,
              }}
            >
              {result.narration}
            </p>
          </section>
        ) : null}

        {result.blocks.length > 0 ? (
          <section>
            <h2
              className="halo-mono-label"
              style={{ marginBottom: "var(--space-3)" }}
            >
              Blocs
            </h2>
            <ul
              className="t-13"
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-2)",
              }}
            >
              {result.blocks.map((b) => (
                <li
                  key={b.id}
                  style={{
                    padding: "var(--space-3) var(--space-4)",
                    background: "var(--bg-elev)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-md, 8px)",
                    color: "var(--text)",
                  }}
                >
                  <strong style={{ fontWeight: 500 }}>
                    {b.label ?? b.id}
                  </strong>{" "}
                  <span className="t-11" style={{ color: "var(--text-faint)" }}>
                    ({b.type})
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
      <CtaFooter />
      <MinimalFooter />
    </>
  );
}

/**
 * Animation entrance discrète pour le CTA — "silent luxury".
 * Inline pour rester scoped à cette page publique sans ajouter de classe globale.
 */
const publicReportKeyframes = `
@keyframes publicReportFadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
`;
