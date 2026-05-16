import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseJsonBody } from "@/lib/platform/http/parse-body";

const schema = z.object({
  name: z.string(),
  count: z.number().int().nonnegative(),
});

function jsonRequest(body: string, init?: RequestInit): Request {
  return new Request("http://test.local/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    ...init,
  });
}

describe("parseJsonBody", () => {
  it("body valide → ok=true + data typée", async () => {
    const req = jsonRequest(JSON.stringify({ name: "x", count: 3 }));
    const r = await parseJsonBody(req, schema);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data).toEqual({ name: "x", count: 3 });
    }
  });

  it("body invalide (schéma) → ok=false + 400 + invalid_body", async () => {
    const req = jsonRequest(JSON.stringify({ name: 1, count: -1 }));
    const r = await parseJsonBody(req, schema);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.response.status).toBe(400);
      const payload = (await r.response.json()) as { error: string; issues: unknown };
      expect(payload.error).toBe("invalid_body");
      expect(payload.issues).toBeDefined();
    }
  });

  it("body non-JSON → ok=false + 400", async () => {
    const req = jsonRequest("<not json>");
    const r = await parseJsonBody(req, schema);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.response.status).toBe(400);
    }
  });

  it("body vide → ok=false + 400", async () => {
    const req = jsonRequest("");
    const r = await parseJsonBody(req, schema);
    expect(r.ok).toBe(false);
  });

  it("body null → ok=false + 400", async () => {
    const req = jsonRequest("null");
    const r = await parseJsonBody(req, schema);
    expect(r.ok).toBe(false);
  });

  it("schéma optionnel accepte body absent", async () => {
    const optional = z.object({ note: z.string().optional() });
    const req = jsonRequest(JSON.stringify({}));
    const r = await parseJsonBody(req, optional);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data).toEqual({});
    }
  });

  // ── P1-A — body-size guard (DoS protection) ────────────────────────────
  describe("body-size guard", () => {
    it("body > 64KB par défaut → ok=false + 413 payload_too_large", async () => {
      // 100KB > 64KB default
      const oversized = JSON.stringify({ name: "x", count: 1, blob: "a".repeat(100_000) });
      const req = new Request("http://test.local/api", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": String(oversized.length),
        },
        body: oversized,
      });
      const r = await parseJsonBody(req, schema);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.response.status).toBe(413);
        const payload = (await r.response.json()) as { error: string; maxBytes: number };
        expect(payload.error).toBe("payload_too_large");
        expect(payload.maxBytes).toBe(64 * 1024);
      }
    });

    it("body 100KB avec maxBytes 200KB → OK", async () => {
      const body = JSON.stringify({ name: "x", count: 1, blob: "a".repeat(100_000) });
      const req = new Request("http://test.local/api", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": String(body.length),
        },
        body,
      });
      const r = await parseJsonBody(req, schema, { maxBytes: 200 * 1024 });
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.data.name).toBe("x");
      }
    });
  });

  // ── P1-B — Content-Type guard ──────────────────────────────────────────
  describe("Content-Type guard", () => {
    it("Content-Type text/plain → ok=false + 415 unsupported_media_type", async () => {
      const req = new Request("http://test.local/api", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: JSON.stringify({ name: "x", count: 1 }),
      });
      const r = await parseJsonBody(req, schema);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.response.status).toBe(415);
        const payload = (await r.response.json()) as { error: string; expected: string };
        expect(payload.error).toBe("unsupported_media_type");
        expect(payload.expected).toBe("application/json");
      }
    });

    it("Content-Type application/json; charset=utf-8 → OK (startsWith match)", async () => {
      const req = new Request("http://test.local/api", {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({ name: "x", count: 1 }),
      });
      const r = await parseJsonBody(req, schema);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.data).toEqual({ name: "x", count: 1 });
      }
    });

    it("Content-Type APPLICATION/JSON (uppercase) → OK (case-insensitive RFC 7231)", async () => {
      const req = new Request("http://test.local/api", {
        method: "POST",
        headers: { "content-type": "APPLICATION/JSON" },
        body: JSON.stringify({ name: "x", count: 1 }),
      });
      const r = await parseJsonBody(req, schema);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.data).toEqual({ name: "x", count: 1 });
      }
    });

    it("Content-Type absent → ok=false + 415", async () => {
      const req = new Request("http://test.local/api", {
        method: "POST",
        body: JSON.stringify({ name: "x", count: 1 }),
      });
      const r = await parseJsonBody(req, schema);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.response.status).toBe(415);
      }
    });
  });
});
