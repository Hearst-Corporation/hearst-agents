import { NextRequest, NextResponse } from "next/server";
import { signCortexToken } from "@/lib/auth/cortex-jwt";
import { getHearstSession, isDevBypassEnabled } from "@/lib/platform/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORTEX_URL = process.env.CORTEX_URL ?? "https://cortex.hearst.app";

// UUID Adrien dev bypass — doit correspondre à lib/platform/auth/session.ts
const DEV_USER_ID = "36914162-75f9-4c27-b38b-bb050f51d52b";
const DEV_USER_EMAIL =
  process.env.CORTEX_ADMIN_EMAILS?.split(",")[0]?.trim() ?? "adrien@beyondcrypto.com";

async function getUserFromRequest(
  _req: NextRequest,
): Promise<{ user_id: string; email: string } | null> {
  // Dev bypass : retourne l'utilisateur admin de développement
  if (isDevBypassEnabled()) {
    return { user_id: DEV_USER_ID, email: DEV_USER_EMAIL };
  }

  const session = await getHearstSession();
  if (!session?.user) return null;

  // userId peut être dans session.userId (top-level) ou session.user.id
  const sessionAny = session as unknown as Record<string, unknown>;
  const userId =
    (sessionAny.userId as string | undefined) ?? (session.user as { id?: string }).id ?? null;

  if (!userId) return null;

  return {
    user_id: userId,
    email: session.user.email ?? "",
  };
}

async function proxyHandler(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const token = await signCortexToken({ user_id: user.user_id, email: user.email });
  if (!token) {
    return NextResponse.json({ error: "cortex_jwt_not_configured" }, { status: 503 });
  }

  const { path } = await ctx.params;
  const url = `${CORTEX_URL}/api/${path.join("/")}${req.nextUrl.search}`;

  const body = req.method !== "GET" && req.method !== "HEAD" ? await req.text() : undefined;

  const upstream = await fetch(url, {
    method: req.method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": req.headers.get("content-type") ?? "application/json",
    },
    body,
  });

  const data = await upstream.text();
  return new NextResponse(data, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/json",
    },
  });
}

export const GET = proxyHandler;
export const POST = proxyHandler;
export const PUT = proxyHandler;
export const DELETE = proxyHandler;
