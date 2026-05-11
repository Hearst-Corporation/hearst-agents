/**
 * Page publique de partage d'une Hearst Card.
 *
 * Server component — pas de SessionProvider. Vérifie le token HMAC,
 * recharge la card data depuis le payload et affiche :
 *   - L'image PNG (si déjà générée et uploadée)
 *   - Sinon, un rendu HTML de la card
 *   - Un bouton "Copier le lien"
 *   - Un CTA PLG "Créer mon Hearst OS →"
 *
 * Open Graph metadata : la card PNG en og:image quand dispo.
 */

import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import { headers } from "next/headers";
import { verifyCardToken } from "@/lib/cockpit/monthly-card-token";
import { buildMonthlyCardData } from "@/lib/cockpit/monthly-card";
import { MonthlyCardView } from "@/lib/cockpit/monthly-card-view";
import { getServerSupabase } from "@/lib/platform/db/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PageProps {
  params: Promise<{ token: string }>;
}

const STORAGE_BUCKET = "assets";

const COPY_LINK_BUTTON_ID = "hearst-card-copy-link";
// Statique : aucune interpolation. Tag stable pour next/script (au lieu de
// document.currentScript.previousElementSibling, fragile si Next déplace
// le tag).
const COPY_LINK_SCRIPT = `
  (function(){
    var btn = document.getElementById('${"hearst-card-copy-link"}');
    if (!btn) return;
    btn.addEventListener('click', function(){
      navigator.clipboard.writeText(window.location.href).then(function(){
        var prev = btn.textContent;
        btn.textContent = 'Lien copié';
        setTimeout(function(){ btn.textContent = prev; }, 1600);
      });
    });
  })();
`;

async function lookupPngUrl(
  userId: string,
  yearMonth: string,
): Promise<string | null> {
  const sb = getServerSupabase();
  if (!sb) return null;
  const path = `hearst-cards/${userId}/${yearMonth}.png`;
  const { data: pub } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return pub?.publicUrl ?? null;
}

async function loadCardForToken(token: string) {
  const verify = verifyCardToken(token);
  if (!verify.ok) {
    return { ok: false as const, reason: verify.reason };
  }
  const { uid, ym } = verify.payload;

  const tenantId = process.env.HEARST_TENANT_ID;
  const workspaceId = process.env.HEARST_WORKSPACE_ID;
  if (!tenantId || !workspaceId) {
    console.error("[public/hearst-card] HEARST_TENANT_ID ou HEARST_WORKSPACE_ID absent — configuration serveur incomplète");
    return { ok: false as const, reason: "server_misconfigured" };
  }

  try {
    const data = await buildMonthlyCardData(
      { userId: uid, tenantId, workspaceId },
      ym,
    );
    const pngUrl = await lookupPngUrl(uid, ym);
    return { ok: true as const, data, pngUrl };
  } catch (err) {
    console.warn("[public/hearst-card] build error:", err);
    return { ok: false as const, reason: "data_unavailable" };
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  const result = await loadCardForToken(token);

  if (!result.ok) {
    return {
      robots: { index: false, follow: false, nocache: true },
      title: "Carte indisponible — Hearst OS",
    };
  }

  const title = `${result.data.window.label} sur Hearst OS`;
  const description = result.data.bestMoment
    ? `${result.data.missionsRun} missions, ${result.data.reportsGenerated} rapports — moment fort : ${result.data.bestMoment.title}`
    : `${result.data.missionsRun} missions, ${result.data.reportsGenerated} rapports générés via Hearst OS.`;

  return {
    robots: { index: false, follow: false, nocache: true },
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "Hearst OS",
      images: result.pngUrl
        ? [{ url: result.pngUrl, width: 1080, height: 1920, alt: title }]
        : undefined,
    },
    twitter: {
      card: result.pngUrl ? "summary_large_image" : "summary",
      title,
      description,
      images: result.pngUrl ? [result.pngUrl] : undefined,
    },
  };
}

export default async function PublicHearstCardPage({ params }: PageProps) {
  await headers();
  const { token } = await params;
  const result = await loadCardForToken(token);

  if (!result.ok) {
    const messages: Record<string, string> = {
      no_secret: "Configuration de partage indisponible.",
      malformed: "Ce lien est mal formé.",
      bad_signature: "Ce lien n'est pas valide.",
      expired: "Ce lien a expiré.",
      data_unavailable: "Impossible de charger les données de la carte.",
    };
    const msg = messages[result.reason] ?? "Carte indisponible.";
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "var(--surface)",
          color: "var(--text)",
          padding: "var(--space-12) var(--space-6)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <h1
          className="t-28"
          style={{ fontWeight: 300, letterSpacing: "-0.02em" }}
        >
          Carte indisponible
        </h1>
        <p
          className="t-13"
          style={{ color: "var(--text-soft)", marginTop: "var(--space-4)" }}
        >
          {msg}
        </p>
        <Link
          href="https://hearstcorporation.io"
          className="t-13"
          style={{
            marginTop: "var(--space-8)",
            color: "var(--accent-teal)",
            textDecoration: "none",
          }}
        >
          Découvrir Hearst OS →
        </Link>
      </main>
    );
  }

  const { data, pngUrl } = result;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--surface)",
        color: "var(--text)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "var(--space-12) var(--space-6)",
      }}
    >
      <header
        style={{
          width: "100%",
          maxWidth: "1080px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "var(--space-8)",
        }}
      >
        <Link
          href="https://hearstcorporation.io"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--space-3)",
            textDecoration: "none",
            color: "var(--text)",
          }}
        >
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "var(--radius-md, 8px)",
              background: "var(--accent-teal)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 600,
              color: "var(--surface)",
            }}
            className="t-15"
          >
            H
          </div>
          <span className="t-15" style={{ fontWeight: 400 }}>
            Hearst OS
          </span>
        </Link>
        <span
          className="t-11"
          style={{
            color: "var(--text-faint)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Wrapped partagé
        </span>
      </header>

      {/* Card preview — soit PNG, soit fallback HTML */}
      <section
        style={{
          width: "100%",
          maxWidth: "540px",
          display: "flex",
          justifyContent: "center",
          marginBottom: "var(--space-8)",
        }}
      >
        {pngUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pngUrl}
            alt={`Hearst Card ${data.window.label}`}
            width={1080}
            height={1920}
            style={{
              width: "100%",
              height: "auto",
              borderRadius: "var(--radius-lg, 16px)",
              boxShadow: "var(--shadow-card-hover, 0 24px 80px var(--accent-teal-surface))",
            }}
          />
        ) : (
          <div
            style={{
              borderRadius: "var(--radius-lg, 16px)",
              overflow: "hidden",
              boxShadow: "var(--shadow-card-hover, 0 24px 80px var(--accent-teal-surface))",
              transform: "scale(0.5)",
              transformOrigin: "top center",
              marginBottom: "-960px", // compensation due au scale
            }}
          >
            <MonthlyCardView data={data} mode="screenshot" />
          </div>
        )}
      </section>

      {/* Actions */}
      <section
        style={{
          display: "flex",
          gap: "var(--space-4)",
          flexWrap: "wrap",
          justifyContent: "center",
          marginBottom: "var(--space-12)",
        }}
      >
        <CopyLinkButton />
        {pngUrl ? (
          <a
            href={pngUrl}
            download={`hearst-${data.window.yearMonth}.png`}
            className="t-13"
            style={{
              padding: "var(--space-3) var(--space-7)",
              borderRadius: "var(--radius-pill, 9999px)",
              background: "transparent",
              color: "var(--text)",
              border: "1px solid var(--border-subtle)",
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            Télécharger PNG
          </a>
        ) : null}
      </section>

      {/* CTA PLG */}
      <section
        style={{
          maxWidth: "540px",
          textAlign: "center",
          padding: "var(--space-12) var(--space-6)",
          borderTop: "1px solid var(--border-subtle)",
          width: "100%",
        }}
      >
        <h2
          className="t-28"
          style={{
            fontWeight: 300,
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
            margin: "var(--space-4) 0 0 0",
            lineHeight: 1.55,
          }}
        >
          Hearst OS génère votre Wrapped chaque mois, automatiquement.
        </p>
        <Link
          href="https://hearstcorporation.io"
          className="t-13"
          style={{
            display: "inline-flex",
            marginTop: "var(--space-6)",
            padding: "var(--space-3) var(--space-8)",
            background: "var(--accent-teal)",
            color: "var(--text)",
            textDecoration: "none",
            borderRadius: "var(--radius-pill, 9999px)",
            fontWeight: 500,
          }}
        >
          Créer mon cockpit →
        </Link>
        <p
          className="t-9"
          style={{
            color: "var(--text-faint)",
            marginTop: "var(--space-3)",
          }}
        >
          Gratuit · Aucune carte requise
        </p>
      </section>

      <footer
        className="t-9"
        style={{
          marginTop: "auto",
          paddingTop: "var(--space-8)",
          color: "var(--text-faint)",
        }}
      >
        © 2026 Hearst Corporation · Carte générée par IA
      </footer>
    </main>
  );
}

/**
 * Bouton "Copier le lien" — minimal, client-side via next/script.
 * Pas de useState/useEffect : on reste server component pur.
 * Le script est 100% statique (constante module COPY_LINK_SCRIPT) — zéro XSS.
 */
function CopyLinkButton() {
  return (
    <>
      <button
        id={COPY_LINK_BUTTON_ID}
        type="button"
        className="t-13"
        style={{
          padding: "var(--space-3) var(--space-7)",
          borderRadius: "var(--radius-pill, 9999px)",
          background: "var(--accent-teal)",
          color: "var(--text)",
          border: "none",
          cursor: "pointer",
          fontWeight: 500,
        }}
      >
        Copier le lien
      </button>
      <Script id="hearst-card-copy-link-init" strategy="afterInteractive">
        {COPY_LINK_SCRIPT}
      </Script>
    </>
  );
}
