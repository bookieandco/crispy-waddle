export type MediaScanVerdict = 'clean' | 'quarantine' | 'rejected' | 'needs_review';

export type MediaScanResult = {
  assetId: string;
  sha256: string;
  verdict: MediaScanVerdict;
  mimeType: string;
  sizeBytes: number;
  reasons: string[];
  scannedAt: string;
};

export interface MediaSecurityScanner {
  scan(input: { assetId: string; uri: string; mimeType: string; sizeBytes: number }): Promise<MediaScanResult>;
}

/**
 * Provider-neutral malware/media safety boundary. Antivirus engines, file-type
 * sniffers and sandbox scanners plug in here; an upload is not trusted merely
 * because its extension says image/video/audio.
 */
export function assertSafeMedia(result: MediaScanResult): void {
  if (result.verdict !== 'clean') {
    throw new Error(`MEDIA_SECURITY_${result.verdict.toUpperCase()}: asset ${result.assetId} cannot enter the trusted asset graph.`);
  }
}

export const MEDIA_SECURITY_RULES = Object.freeze({
  requireMimeValidation: true,
  requireSizeLimit: true,
  requireHash: true,
  quarantineOnScanFailure: true,
  neverExecuteUploadedFiles: true,
  neverTrustFilenameExtension: true,
});
