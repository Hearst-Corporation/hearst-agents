/**
 * Hearst Card — Page de rendu interne.
 *
 * Sert de cible pour :
 *   - Le screenshotter Playwright (mode `screenshot=1`) — accès via token
 *     HMAC `mode=render` (bypass auth), supprime tous les chromes pour
 *     un screenshot propre 1080×1920.
 *   - L'utilisateur loggé qui veut prévisualiser sa card avant partage —
 *     accès via session NextAuth qui matche `userId` du path.
 *
 * Note : on n'utilise PAS le SessionProvider du layout `(user)` pour
 * pouvoir bypasser l'auth via token HMAC. La vérification d'auth se fait
 * inline ici via `getUserId()`.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { buildMonthlyCardData } from "@/lib/cockpit/monthly-card";
import { MonthlyCardView } from "@/lib/cockpit/monthly-card-view";
import { verifyCardToken } from "@/lib/cockpit/monthly-card-token";
import { getUserId } from "@/lib/platform/auth/get-user-id";
import { requireScope } from "@/lib/platform/auth/scope";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PageProps {
  params: Promise<{ userId: string; yearMonth: string }>;
  searchParams: Promise<{ token?: string; screenshot?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { yearMonth } = await params;
  return {
    robots: { index: false, follow: false, nocache: true },
    title: `Hearst Card — ${yearMonth}`,
  };
}

async function authorize({
  pathUserId,
  yearMonth,
  token,
}: {
  pathUserId: string;
  yearMonth: string;
  token?: string;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  // 1. Token HMAC (mode render OU public — les deux donnent accès au rendu).
  if (token) {
    const verify = verifyCardToken(token);
    if (!verify.ok) return { ok: false, reason: verify.reason };
    if (verify.payload.uid !== pathUserId) {
      return { ok: false, reason: "user_mismatch" };
    }
    if (verify.payload.ym !== yearMonth) {
      return { ok: false, reason: "year_month_mismatch" };
    }
    return { ok: true };
  }

  // 2. Session loggée qui matche le userId du path.
  const userId = await getUserId();
  if (!userId) return { ok: false, reason: "not_authenticated" };
  if (userId !== pathUserId) return { ok: false, reason: "forbidden" };
  return { ok: true };
}

export default async function HearstCardPage({ params, searchParams }: PageProps) {
  await headers();
  const { userId: pathUserId, yearMonth } = await params;
  const { token, screenshot } = await searchParams;

  const auth = await authorize({ pathUserId, yearMonth, token });
  if (!auth.ok) {
    if (auth.reason === "not_authenticated") {
      return (
        <main
          style={{
            padding: "var(--space-12, 48px)",
            color: "var(--text)",
            background: "var(--surface)",
            minHeight: "100vh",
          }}
        >
          <h1 style={{ fontWeight: 300 }}>Connexion requise</h1>
          <p>Connectez-vous pour voir votre Hearst Card.</p>
        </main>
      );
    }
    return notFound();
  }

  // Récupère le scope tenant depuis la session (source de vérité JWT).
  // Pour le mode token HMAC (screenshotter), on utilise la var env car
  // il n'y a pas de session utilisateur dans ce mode.
  let tenantId: string;
  let workspaceId: string;
  if (token) {
    // Mode render/public : pas de session, on lit l'env
    tenantId = process.env.HEARST_TENANT_ID ?? "";
    workspaceId = process.env.HEARST_WORKSPACE_ID ?? "";
    if (!tenantId || !workspaceId) {
      console.error("[hearst-card] HEARST_TENANT_ID ou HEARST_WORKSPACE_ID absent");
      return notFound();
    }
  } else {
    // Mode session loggée : scope depuis JWT
    const { scope, error } = await requireScope({ context: "hearst-card render" });
    if (error) return notFound();
    tenantId = scope.tenantId;
    workspaceId = scope.workspaceId;
  }

  const data = await buildMonthlyCardData(
    { userId: pathUserId, tenantId, workspaceId },
    yearMonth,
  );

  const isScreenshot = screenshot === "1" || screenshot === "true";

  return (
    <>
      {isScreenshot ? (
        <style>{`
          html, body { margin: 0; padding: 0; background: var(--surface); }
          body { width: 1080px; height: 1920px; }
        `}</style>
      ) : null}
      <MonthlyCardView data={data} mode={isScreenshot ? "screenshot" : "screen"} />
    </>
  );
}
