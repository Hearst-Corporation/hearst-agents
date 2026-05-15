import { describe, expect, it, vi } from "vitest";
import { findOrphanedFiles } from "@/lib/engine/runtime/assets/cleanup/worker";
import type { StorageObject, StorageProvider } from "@/lib/engine/runtime/assets/storage/types";

// Minimal StorageProvider mock — only list() is needed for orphan detection.
function makeStorage(objects: Partial<StorageObject>[]): StorageProvider {
  return {
    type: "local",
    list: vi.fn().mockResolvedValue(
      objects.map((o) => ({
        key: o.key ?? "unknown",
        size: o.size ?? 0,
        contentType: "application/octet-stream",
        lastModified: o.lastModified ?? new Date(),
        metadata: {},
      })),
    ),
    upload: vi.fn(),
    download: vi.fn(),
    getSignedUrl: vi.fn(),
    delete: vi.fn(),
    exists: vi.fn(),
    health: vi.fn(),
  } as unknown as StorageProvider;
}

// Minimal Supabase client mock — only the assets.content_ref select chain is needed.
function makeDb(knownRefs: string[]) {
  return {
    from: (table: string) => {
      if (table !== "assets") throw new Error(`Unexpected table: ${table}`);
      return {
        select: () => ({
          not: () => ({
            range: async (_from: number, _to: number) => ({
              data: knownRefs.map((ref) => ({ content_ref: ref })),
              error: null,
            }),
          }),
        }),
      };
    },
  };
}

describe("findOrphanedFiles", () => {
  it("returns the storage file not referenced by any asset row", async () => {
    const storage = makeStorage([
      { key: "runs/a/file-a.pdf" },
      { key: "runs/b/file-b.pdf" },
      { key: "runs/c/orphan.pdf" }, // ← pas dans la table assets
    ]);

    // DB connaît seulement les deux premiers fichiers
    const db = makeDb(["runs/a/file-a.pdf", "runs/b/file-b.pdf"]);

    const orphans = await findOrphanedFiles(db as ReturnType<typeof makeDb> as never, storage);

    expect(orphans).toHaveLength(1);
    expect(orphans[0].key).toBe("runs/c/orphan.pdf");
  });

  it("returns empty array when storage is empty", async () => {
    const storage = makeStorage([]);
    const db = makeDb(["runs/a/file-a.pdf"]);

    const orphans = await findOrphanedFiles(db as never, storage);
    expect(orphans).toHaveLength(0);
  });

  it("returns empty array when all storage files are referenced", async () => {
    const storage = makeStorage([{ key: "runs/x/file.pdf" }]);
    const db = makeDb(["runs/x/file.pdf"]);

    const orphans = await findOrphanedFiles(db as never, storage);
    expect(orphans).toHaveLength(0);
  });
});
