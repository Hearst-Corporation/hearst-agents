/**
 * Debug Session — Dump session JWT for troubleshooting
 * DEV ONLY — Remove in production
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/platform/auth/options";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not_available_in_production" }, { status: 403 });
  }

  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  // Expose full session structure for debugging
  return NextResponse.json({
    session: {
      user: session.user,
      userId: session.userId,
      tenantId: session.tenantId,
      workspaceId: session.workspaceId,
    },
    raw: session,
  });
}
