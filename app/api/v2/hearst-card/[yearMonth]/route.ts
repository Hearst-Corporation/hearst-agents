/**
 * POST /api/v2/hearst-card/[yearMonth]
 *
 * Génère (ou réutilise) la Hearst Card mensuelle PNG d'un user et retourne
 * l'URL publique de partage. Pipeline :
 *
 *   1. Auth via `requireScope` — l'user ne peut générer QUE sa propre card.
 *   2. Build payload via `buildMonthlyCardData` (cache 1h).
 *   3. Si la card est déjà uploadée + récente (<1h pour le mois en cours,
 *      >0 pour les mois clos), réutiliser l'URL existante.
 *   4. Sinon, générer un PNG via Playwright (mode `screenshot=1` sur la
 *      page de rendu interne) et l'uploader sur Supabase Storage.
 *      Fallback : si Playwright n'est pas chargeable (Vercel sans
 *      chromium), on retourne l'URL de la page HTML directement et un
 *      flag `pngAvailable: false` — le client peut alors offrir un
 *      "Voir en plein écran" + "Faire une capture manuelle".
 *   5. Sign un token public HMAC pour la page de partage.
 *
 * GET sert de raccourci pour récupérer l'URL existante sans régénération.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireScope } from "@/lib/platform/auth/scope";
import { getServerSupabase } from "@/lib/platform/db/supabase";
import { withScope } from "@/lib/platform/http/route-handler";

const hearstCardBodySchema = z
  .object({
    force: z.boolean().optional(),
  })
  .optional();

import { buildMonthlyCardData, type MonthlyCardData } from "@/lib/cockpit/monthly-card";
import {
  buildPublicCardUrl,
  buildRenderCardUrl,
  signCardToken,
} from "@/lib/cockpit/monthly-card-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STORAGE_BUCKET = "assets";
const CARD_PATH_PREFIX = "hearst-cards";
const PNG_FRESHNESS_MS = 60 * 60_000; // 1h pour le mois en cours
const PLAYWRIGHT_TIMEOUT_MS = 30_000;

interface CardArtifact {
  pngUrl: string | null;
  publicShareUrl: string;
  renderUrl: string;
  data: MonthlyCardData;
  generated: boolean;
  pngAvailable: boolean;
}

function buildStoragePath(userId: string, yearMonth: string): string {
  return `${CARD_PATH_PREFIX}/${userId}/${yearMonth}.png`;
}

async function getExistingPng(
  userId: string,
  yearMonth: string,
): Promise<{ url: string; freshMs: number } | null> {
  const sb = getServerSupabase();
  if (!sb) return null;

  const path = buildStoragePath(userId, yearMonth);
  // List the parent prefix so we get metadata (created_at).
  const { data, error } = await sb.storage
    .from(STORAGE_BUCKET)
    .list(`${CARD_PATH_PREFIX}/${userId}`, {
      search: `${yearMonth}.png`,
      limit: 1,
    });
  if (error || !data || data.length === 0) return null;
  const obj = data.find((f) => f.name === `${yearMonth}.png`);
  if (!obj) return null;

  const { data: pub } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  if (!pub?.publicUrl) return null;

  const updatedAtRaw = (obj as unknown as { updated_at?: string }).updated_at;
  const ts = updatedAtRaw ? new Date(updatedAtRaw).getTime() : Date.now();
  return { url: pub.publicUrl, freshMs: Date.now() - ts };
}

async function uploadPngBuffer(
  userId: string,
  yearMonth: string,
  buffer: Buffer,
): Promise<string | null> {
  const sb = getServerSupabase();
  if (!sb) return null;
  const path = buildStoragePath(userId, yearMonth);
  const { error } = await sb.storage.from(STORAGE_BUCKET).upload(path, buffer, {
    contentType: "image/png",
    upsert: true,
  });
  if (error) {
    console.error("[hearst-card] upload error:", error.message);
    return null;
  }
  const { data: pub } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return pub?.publicUrl ?? null;
}

/**
 * Génère le PNG via Playwright en navigant vers la page de rendu
 * interne. Retourne null si Playwright n'est pas dispo (ce qui est OK :
 * la page HTML reste partageable telle quelle).
 */
async function renderPngViaPlaywright(renderUrl: string): Promise<Buffer | null> {
  // Import dynamique pour rester compatible Vercel / serverless. Si
  // playwright n'est pas chargeable (pas de chromium binaries), on log
  // et on retombe gracieusement sur null.
  let chromium: unknown;
  try {
    // Tente d'abord playwright-core (pas de download bundle), puis playwright.
    const mod =
      (await import("playwright-core").catch(() => null)) ??
      (await import("playwright").catch(() => null));
    if (!mod) {
      console.warn("[hearst-card] playwright non installé — skip PNG render");
      return null;
    }
    chromium = (mod as { chromium: unknown }).chromium;
  } catch (err) {
    console.warn("[hearst-card] playwright import failed:", err);
    return null;
  }

  const cr = chromium as {
    launch: (opts?: Record<string, unknown>) => Promise<{
      newContext: (opts?: Record<string, unknown>) => Promise<{
        newPage: () => Promise<{
          goto: (url: string, opts?: Record<string, unknown>) => Promise<unknown>;
          screenshot: (opts?: Record<string, unknown>) => Promise<Buffer>;
          close: () => Promise<void>;
        }>;
        close: () => Promise<void>;
      }>;
      close: () => Promise<void>;
    }>;
  };

  let browser: Awaited<ReturnType<typeof cr.launch>> | null = null;
  try {
    browser = await cr.launch({ headless: true });
    const ctx = await browser.newContext({
      viewport: { width: 1080, height: 1920 },
      deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    await page.goto(renderUrl, {
      waitUntil: "networkidle",
      timeout: PLAYWRIGHT_TIMEOUT_MS,
    });
    const png = await page.screenshot({
      fullPage: false,
      type: "png",
      clip: { x: 0, y: 0, width: 1080, height: 1920 },
    });
    await ctx.close();
    return Buffer.isBuffer(png) ? png : Buffer.from(png as Uint8Array);
  } catch (err) {
    console.warn("[hearst-card] playwright render failed:", err);
    return null;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

async function generateCard(
  scope: { userId: string; tenantId: string; workspaceId: string },
  yearMonth: string,
  options: { force?: boolean } = {},
): Promise<CardArtifact | { error: string; status: number }> {
  // 1. Build data (cache 1h interne).
  let data: MonthlyCardData;
  try {
    data = await buildMonthlyCardData(
      {
        userId: scope.userId,
        tenantId: scope.tenantId,
        workspaceId: scope.workspaceId,
      },
      yearMonth,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: `invalid_yearMonth: ${msg}`, status: 400 };
  }

  // 2. Sign tokens (public + render).
  const publicSigned = signCardToken({
    userId: scope.userId,
    yearMonth,
    mode: "public",
  });
  const renderSigned = signCardToken({
    userId: scope.userId,
    yearMonth,
    mode: "render",
    ttlHours: 1, // courte durée — uniquement pour le screenshot synchrone
  });
  if (!publicSigned || !renderSigned) {
    return { error: "sharing_secret_missing", status: 503 };
  }

  const publicShareUrl = buildPublicCardUrl(publicSigned.token);
  const renderUrl = buildRenderCardUrl(scope.userId, yearMonth, renderSigned.token);

  // 3. Réutilise un PNG existant si suffisamment frais.
  if (!options.force) {
    const existing = await getExistingPng(scope.userId, yearMonth);
    if (existing) {
      const isCurrentMonth = data.window.inProgress;
      const stale = isCurrentMonth && existing.freshMs > PNG_FRESHNESS_MS;
      if (!stale) {
        return {
          pngUrl: existing.url,
          publicShareUrl,
          renderUrl,
          data,
          generated: false,
          pngAvailable: true,
        };
      }
    }
  }

  // 4. Génère un nouveau PNG via Playwright.
  // L'URL de rendu doit être absolue pour Playwright headless.
  const renderUrlWithFlag = `${renderUrl}&screenshot=1`;
  const buffer = await renderPngViaPlaywright(renderUrlWithFlag);
  if (!buffer) {
    return {
      pngUrl: null,
      publicShareUrl,
      renderUrl,
      data,
      generated: false,
      pngAvailable: false,
    };
  }

  const uploadedUrl = await uploadPngBuffer(scope.userId, yearMonth, buffer);
  return {
    pngUrl: uploadedUrl,
    publicShareUrl,
    renderUrl,
    data,
    generated: true,
    pngAvailable: !!uploadedUrl,
  };
}

interface RouteContext {
  params: Promise<{ yearMonth: string }>;
}

export async function POST(req: Request, context: RouteContext) {
  const { scope, error } = await requireScope({
    context: "POST /api/v2/hearst-card/[yearMonth]",
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  const { yearMonth } = await context.params;
  const rawBody = await req.json().catch(() => null);
  const parsedBody = rawBody !== null ? hearstCardBodySchema?.safeParse(rawBody) : undefined;
  if (parsedBody && !parsedBody.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsedBody.error.flatten() },
      { status: 400 },
    );
  }
  const force = parsedBody?.data?.force ?? false;

  const result = await generateCard(scope, yearMonth, { force });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    yearMonth,
    label: result.data.window.label,
    inProgress: result.data.window.inProgress,
    pngUrl: result.pngUrl,
    pngAvailable: result.pngAvailable,
    publicShareUrl: result.publicShareUrl,
    renderUrl: result.renderUrl,
    generated: result.generated,
    summary: {
      missionsRun: result.data.missionsRun,
      reportsGenerated: result.data.reportsGenerated,
      anomaliesCount: result.data.anomaliesCount,
      kpis: result.data.kpis,
    },
  });
}

export const GET = withScope<{ yearMonth: string }>(
  "GET /api/v2/hearst-card/[yearMonth]",
  async (_req, { scope, params }) => {
    const { yearMonth } = params;
    // GET = best-effort lookup, jamais de génération synchrone.
    const result = await generateCard(scope, yearMonth);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      yearMonth,
      label: result.data.window.label,
      pngUrl: result.pngUrl,
      pngAvailable: result.pngAvailable,
      publicShareUrl: result.publicShareUrl,
      renderUrl: result.renderUrl,
      summary: {
        missionsRun: result.data.missionsRun,
        reportsGenerated: result.data.reportsGenerated,
        anomaliesCount: result.data.anomaliesCount,
        kpis: result.data.kpis,
      },
    });
  },
);
