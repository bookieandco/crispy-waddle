import { describe, expect, it } from "vitest";
import { validateUniversalUpload, validateUniversalUploadDeclaration } from "./universal-upload-validation";

describe("validateUniversalUpload", () => {
  it("recognizes PDF by bytes, not extension", () => {
    const result = validateUniversalUpload({
      declaredMediaType: "application/pdf",
      bytes: new TextEncoder().encode("%PDF-1.7\n"),
    });
    expect(result.modality).toBe("document");
  });

  it("recognizes ISO BMFF video", () => {
    const bytes = new Uint8Array([0,0,0,24,102,116,121,112,105,115,111,109]);
    expect(validateUniversalUpload({ declaredMediaType: "video/mp4", bytes }).modality).toBe("video");
  });

  it("rejects a declared image whose bytes are not an image", () => {
    expect(() => validateUniversalUpload({
      declaredMediaType: "image/png",
      bytes: new TextEncoder().encode("not a png"),
    })).toThrow("TYPE_MISMATCH_OR_UNSUPPORTED");
  });

  it("rejects empty uploads", () => {
    expect(() => validateUniversalUpload({
      declaredMediaType: "application/pdf",
      bytes: new Uint8Array(),
    })).toThrow("UPLOAD_EMPTY");
  });
  it("accepts declared direct-upload metadata without trusting filename bytes", () => {
    const result = validateUniversalUploadDeclaration({
      declaredMediaType: "video/mp4",
      byteLength: 100 * 1024 * 1024,
    });
    expect(result.modality).toBe("video");
  });

  it("enforces modality limits before issuing a direct-upload token", () => {
    expect(() => validateUniversalUploadDeclaration({
      declaredMediaType: "image/png",
      byteLength: 30 * 1024 * 1024,
    })).toThrow("UPLOAD_TOO_LARGE_FOR_IMAGE");
  });

  it("rejects unsupported declared media before direct upload", () => {
    expect(() => validateUniversalUploadDeclaration({
      declaredMediaType: "application/x-msdownload",
      byteLength: 1024,
    })).toThrow("UPLOAD_TYPE_UNSUPPORTED");
  });
});
