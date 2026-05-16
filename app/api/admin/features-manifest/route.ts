import { exec } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { redactedError, withRoute } from "@/lib/observability/logger";
import { withAdmin } from "@/lib/platform/http/route-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execAsync = promisify(exec);
const log = withRoute("POST /api/admin/features-manifest");

export const POST = withAdmin(
  "admin/features-manifest",
  { resource: "settings", action: "admin" },
  async (_req, { scope }) => {
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
  },
);
