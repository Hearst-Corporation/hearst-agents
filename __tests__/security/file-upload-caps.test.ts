/**
 * B2.2 — File upload caps + magic bytes validation
 *
 * F-043 : Upload sans cap mémoire / MIME forgeable
 * Tests la route POST /api/v2/documents/upload
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockRequireScope = vi.hoisted(() => vi.fn());
const mockParseDocumentBuffer = vi.hoisted(() => vi.fn());

vi.mock("@/lib/platform/auth/scope", () => ({
  requireScope: mockRequireScope,
}));

vi.mock("@/lib/capabilities/providers/llamaparse", () => ({
  parseDocumentBuffer: mockParseDocumentBuffer,
}));

// Import de la route APRÈS les mocks
import { POST } from "@/app/api/v2/documents/upload/route";

// ── Helpers ──────────────────────────────────────────────────────────────────

const MAX_BYTES = 25 * 1024 * 1024; // 25 Mo

const VALID_SCOPE = {
  userId: "user-test",
  tenantId: "tenant-test",
  workspaceId: "ws-test",
  isDevFallback: false,
};

/** Crée un PDF valide minimal (magic bytes corrects) */
function makePdfBlob(extraBytes = 0): Blob {
  const magic = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
  const padding = new Uint8Array(extraBytes);
  const combined = new Uint8Array(magic.length + padding.length);
  combined.set(magic);
  combined.set(padding, magic.length);
  return new Blob([combined], { type: "application/pdf" });
}

/** Crée un fichier PE (exécutable Windows) renommé en .pdf */
function makeFakePdfBlob(): Blob {
  // PE magic bytes : MZ (0x4D 0x5A)
  const peBytes = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x01, 0x00, 0x00, 0x00]);
  return new Blob([peBytes], { type: "application/pdf" });
}

function makeRequest(blob: Blob, filename = "test.pdf"): Request {
  const formData = new FormData();
  formData.append("file", new File([blob], filename, { type: blob.type }));
  return new Request("http://localhost/api/v2/documents/upload", {
    method: "POST",
    body: formData,
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/v2/documents/upload — caps + magic bytes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireScope.mockResolvedValue({ scope: VALID_SCOPE, error: null });
    mockParseDocumentBuffer.mockResolvedValue({ markdown: "# Test", pages: 1 });
  });

  it("retourne 413 si le fichier dépasse 25 Mo", async () => {
    // Crée un blob de 30 Mo — size est connu au niveau Blob, pas besoin de lire les bytes
    // On génère un fichier avec magic bytes valides mais très grand
    const oversizedBlob = makePdfBlob(30 * 1024 * 1024);
    const req = makeRequest(oversizedBlob);
    const res = await POST(req);
    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error).toBe("file_too_large");
    expect(body.maxBytes).toBe(MAX_BYTES);
  });

  it("retourne 400 si les magic bytes ne correspondent pas à un PDF", async () => {
    const fakeBlob = makeFakePdfBlob();
    const req = makeRequest(fakeBlob, "malware.pdf");
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_pdf_magic");
  });

  it("retourne 400 si le MIME type n'est pas application/pdf", async () => {
    const blob = new Blob(["some text"], { type: "text/plain" });
    const req = makeRequest(blob, "doc.txt");
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Seuls les PDF sont supportés");
  });

  it("retourne 200 pour un PDF valide sous les caps", async () => {
    const validBlob = makePdfBlob(100); // petit fichier, magic bytes corrects
    const req = makeRequest(validBlob, "valid.pdf");
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text).toBeDefined();
    expect(body.pageCount).toBe(1);
  });

  it("retourne 400 si aucun fichier n'est joint", async () => {
    const formData = new FormData();
    const req = new Request("http://localhost/api/v2/documents/upload", {
      method: "POST",
      body: formData,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Fichier manquant");
  });

  it("retourne 401 si non authentifié", async () => {
    mockRequireScope.mockResolvedValueOnce({
      scope: null,
      error: { message: "not_authenticated", status: 401 },
    });

    const validBlob = makePdfBlob(100);
    const req = makeRequest(validBlob);
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
