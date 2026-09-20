import type { MediaScanResult, MediaSecurityScanner } from "@jhadina/security-core";

const VERDICTS = new Set(["clean", "quarantine", "rejected", "needs_review"]);

export class HttpMediaSecurityScanner implements MediaSecurityScanner {
  constructor(
    private readonly endpoint: string,
    private readonly token?: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    if (!endpoint.trim()) throw new Error("MEDIA_SCANNER_ENDPOINT_REQUIRED");
  }

  async scan(input: {
    assetId: string;
    uri: string;
    mimeType: string;
    sizeBytes: number;
  }): Promise<MediaScanResult> {
    const response = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
      },
      body: JSON.stringify(input),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`MEDIA_SCANNER_HTTP_${response.status}`);
    }

    const raw = await response.json() as Partial<MediaScanResult>;
    if (raw.assetId !== input.assetId) throw new Error("MEDIA_SCANNER_ASSET_MISMATCH");
    if (raw.mimeType !== input.mimeType) throw new Error("MEDIA_SCANNER_MIME_MISMATCH");
    if (raw.sizeBytes !== input.sizeBytes) throw new Error("MEDIA_SCANNER_SIZE_MISMATCH");
    if (typeof raw.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(raw.sha256)) {
      throw new Error("MEDIA_SCANNER_SHA256_INVALID");
    }
    if (typeof raw.verdict !== "string" || !VERDICTS.has(raw.verdict)) {
      throw new Error("MEDIA_SCANNER_VERDICT_INVALID");
    }
    if (!Array.isArray(raw.reasons) || raw.reasons.some((reason) => typeof reason !== "string")) {
      throw new Error("MEDIA_SCANNER_REASONS_INVALID");
    }
    if (typeof raw.scannedAt !== "string" || Number.isNaN(Date.parse(raw.scannedAt))) {
      throw new Error("MEDIA_SCANNER_TIMESTAMP_INVALID");
    }

    return {
      assetId: raw.assetId,
      sha256: raw.sha256.toLowerCase(),
      verdict: raw.verdict as MediaScanResult["verdict"],
      mimeType: raw.mimeType,
      sizeBytes: raw.sizeBytes,
      reasons: [...raw.reasons],
      scannedAt: raw.scannedAt,
    };
  }
}
