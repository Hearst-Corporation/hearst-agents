import { parseDocumentBuffer } from "@/lib/capabilities/providers/llamaparse";
import { requireScope } from "@/lib/platform/auth/scope";

export const maxDuration = 60;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Taille maximale acceptée : 25 Mo */
const MAX_BYTES = 25 * 1024 * 1024;

/** Magic bytes PDF : "%PDF" (0x25 0x50 0x44 0x46) */
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46] as const;

function hasPdfMagic(buffer: ArrayBuffer): boolean {
  const sig = new Uint8Array(buffer, 0, 4);
  return PDF_MAGIC.every((b, i) => sig[i] === b);
}

export async function POST(request: Request): Promise<Response> {
  // Auth gate : sans ça l'endpoint est public et brûle des tokens
  // LlamaParse pour n'importe quel client.
  const { scope, error } = await requireScope({ context: "POST /api/v2/documents/upload" });
  if (error || !scope) {
    return Response.json(
      { error: error?.message ?? "not_authenticated" },
      { status: error?.status ?? 401 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof Blob)) {
    return Response.json({ error: "Fichier manquant" }, { status: 400 });
  }

  // Cap taille : 25 Mo max
  if (file.size > MAX_BYTES) {
    return Response.json(
      { error: "file_too_large", maxBytes: MAX_BYTES },
      { status: 413 },
    );
  }

  if (file.type !== "application/pdf") {
    return Response.json({ error: "Seuls les PDF sont supportés" }, { status: 400 });
  }

  const fileName = file instanceof File ? file.name : "document.pdf";

  try {
    const buffer = await file.arrayBuffer();

    // Validation magic bytes — empêche les fichiers PE/ZIP/etc. renommés .pdf
    if (!hasPdfMagic(buffer)) {
      return Response.json(
        { error: "invalid_pdf_magic", message: "Le fichier n'est pas un PDF valide" },
        { status: 400 },
      );
    }

    const { markdown, pages } = await parseDocumentBuffer(buffer, fileName, file.type);
    return Response.json({ text: markdown, pageCount: pages, fileName });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return Response.json({ error: "Échec du parsing", details: message }, { status: 500 });
  }
}
