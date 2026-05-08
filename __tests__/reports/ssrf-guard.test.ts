/**
 * Tests SSRF guard pour lib/reports/sources/http.ts.
 *
 * La validation SSRF est synchrone (avant tout fetch) — pas besoin de mock
 * réseau : si isSafeUrl retourne false, fetchHttp retourne immédiatement
 * { ok: false, error: "URL refusée (SSRF guard): ..." }.
 */

import { describe, it, expect } from "vitest";
import { fetchHttp } from "@/lib/reports/sources/http";

describe("fetchHttp — SSRF guard", () => {
  it("bloque localhost:8080", async () => {
    const result = await fetchHttp({ url: "http://localhost:8080/data" });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/SSRF/i);
  });

  it("bloque les IPs privées 192.168.x.x", async () => {
    const result = await fetchHttp({ url: "http://192.168.1.1/api" });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/SSRF/i);
  });

  it("bloque 127.0.0.1 (loopback)", async () => {
    const result = await fetchHttp({ url: "http://127.0.0.1/api" });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/SSRF/i);
  });

  it("bloque les IPs privées 10.x.x.x", async () => {
    const result = await fetchHttp({ url: "http://10.0.0.1/api" });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/SSRF/i);
  });
});
