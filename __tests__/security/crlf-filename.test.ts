/**
 * CRLF Content-Disposition Test — F-055
 *
 * Valide que les routes export/download ne sont pas vulnérables
 * aux injections CRLF dans Content-Disposition.
 */

import { describe, expect, it } from "vitest";
import { safeFilename } from "@/lib/utils/safe-filename";

describe("CRLF Content-Disposition Safety (F-055)", () => {
  it("should sanitize filenames by removing CR/LF", () => {
    // safeFilename("report\r\nX-Injected: value.pdf") → "report__X-Injected: value.pdf"
    const result = safeFilename("report\r\nX-Injected: value.pdf");
    expect(result).toBe("report__X-Injected: value.pdf");
    expect(result).not.toContain("\r");
    expect(result).not.toContain("\n");
  });

  it("should remove quotes from filenames to prevent escape", () => {
    // safeFilename('report"malicious".pdf') → 'report_malicious_.pdf'
    const result = safeFilename('report"malicious".pdf');
    expect(result).toBe("report_malicious_.pdf");
    expect(result).not.toContain('"');
  });

  it("should remove backslashes from filenames", () => {
    // safeFilename('report\\malicious.pdf') → 'report_malicious.pdf'
    const result = safeFilename("report\\malicious.pdf");
    expect(result).toBe("report_malicious.pdf");
    expect(result).not.toContain("\\");
  });

  it("should limit filename length to 200 chars", () => {
    // Évite les filenames excessivement longs
    const longName = "a".repeat(300) + ".pdf";
    const result = safeFilename(longName);
    expect(result.length).toBeLessThanOrEqual(200);
  });

  it("should preserve normal filenames", () => {
    // Les noms normaux ne doivent pas être modifiés
    const result = safeFilename("report.pdf");
    expect(result).toBe("report.pdf");
  });

  it("should preserve UTF-8 characters", () => {
    // Les caractères UTF-8 normaux doivent être préservés
    const result = safeFilename("rapport-été-2024.pdf");
    expect(result).toContain("été");
    expect(result).toContain("é");
  });

  it("should handle multiple dangerous characters", () => {
    // Combine plusieurs caractères dangereux
    const result = safeFilename('report"test\r\n\\file.pdf');
    expect(result).toBe("report_test___file.pdf");
    expect(result).not.toContain('"');
    expect(result).not.toContain("\r");
    expect(result).not.toContain("\n");
    expect(result).not.toContain("\\");
  });

  it("should handle empty string", () => {
    // Un string vide doit rester vide
    const result = safeFilename("");
    expect(result).toBe("");
  });

  it("should handle only dangerous characters", () => {
    // Un string composé uniquement de caractères dangereux
    const result = safeFilename('\r\n"\\');
    expect(result).toBe("____");
  });

  it("should truncate very long filenames before sanitizing", () => {
    // Le troncage s'applique après remplacement des caractères dangereux
    const longNameWithDangerousChars = "a".repeat(150) + "\r\n" + "b".repeat(100) + ".pdf";
    const result = safeFilename(longNameWithDangerousChars);
    expect(result.length).toBeLessThanOrEqual(200);
    expect(result).not.toContain("\r");
    expect(result).not.toContain("\n");
  });

  it("should properly encode for RFC 2183 Content-Disposition", () => {
    // Vérifie que les caractères spéciaux problématiques sont bien échappés
    const unsafe = 'file"name.pdf';
    const result = safeFilename(unsafe);
    expect(result).toBe("file_name.pdf");
    // Maintenant le filename peut être utilisé safely dans Content-Disposition
    const disposition = `attachment; filename="${result}"`;
    expect(disposition).not.toContain('""');
  });
});
