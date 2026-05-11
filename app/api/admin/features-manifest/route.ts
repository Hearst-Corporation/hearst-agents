import { NextResponse } from "next/server";
import { requireAdmin, isError } from "@/app/api/admin/_helpers";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { redactedError, withRoute } from "@/lib/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execAsync = promisify(exec);
const log = withRoute("POST /api/admin/features-manifest");

export async function POST(_request: Request) {
  const guard = await requireAdmin("admin/features-manifest", { resource: "settings", action: "admin" });
  if (isError(guard)) return guard;
  const { scope } = guard;

  try {
    const cwd = process.cwd();
    const scriptPath = path.join(cwd, "scripts", "build-features-manifest.mjs");
    await execAsync(`node ${scriptPath}`, { cwd });

    // Lire le manifest mis à jour
    const fs = await import("node:fs/promises");
    const manifestPath = path.join(cwd, "docs", "features", "_manifest.json");
    const raw = await fs.readFile(manifestPath, "utf-8");
    const manifest = JSON.parse(raw) as unknown;

    return NextResponse.json({
      ok: true,
      manifest,
      scope: { isDevFallback: scope.isDevFallback },
    });
  } catch (e) {
    log.error({ err: redactedError(e) }, "manifest_build_failed");
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: "manifest_error", message: msg }, { status: 500 });
  }
}
