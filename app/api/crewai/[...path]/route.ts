import { NextRequest, NextResponse } from "next/server";

const CREWAI_ENGINE_URL = process.env.CREWAI_ENGINE_URL ?? "http://127.0.0.1:8000";
const CREWAI_API_KEY = process.env.CREWAI_API_KEY ?? "";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const target = `${CREWAI_ENGINE_URL}/${path.join("/")}${req.nextUrl.search}`;

  const headers: Record<string, string> = {
    "Content-Type": req.headers.get("content-type") ?? "application/json",
  };
  if (CREWAI_API_KEY) headers["Authorization"] = `Bearer ${CREWAI_API_KEY}`;

  const body = req.method !== "GET" && req.method !== "HEAD" ? await req.text() : undefined;

  try {
    const res = await fetch(target, {
      method: req.method,
      headers,
      body,
      signal: AbortSignal.timeout(30_000),
    });
    const data = await res.text();
    return new NextResponse(data, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "crewai_engine_unreachable",
        target,
        message: (err as Error)?.message ?? "fetch failed",
      },
      { status: 503 },
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
