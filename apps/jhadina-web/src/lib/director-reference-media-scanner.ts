import { createHash } from 'node:crypto';
import type { MediaScanResult, MediaSecurityScanner } from '@jhadina/security-core';

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * Scans Director's post-sanitization PNG, not the untrusted source container.
 * The source upload has already been decoded and re-encoded to pixels only.
 */
export class DirectorSanitizedImageScanner implements MediaSecurityScanner {
  async scan(input: {
    assetId: string;
    uri: string;
    mimeType: string;
    sizeBytes: number;
  }): Promise<MediaScanResult> {
    const reasons: string[] = [];
    let verdict: MediaScanResult['verdict'] = 'clean';
    let digest = '';

    try {
      if (input.mimeType !== 'image/png') {
        reasons.push('DIRECTOR_MEDIA_SCAN_NORMALIZED_PNG_REQUIRED');
        verdict = 'rejected';
      }
      if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0 || input.sizeBytes > 25 * 1024 * 1024) {
        reasons.push('DIRECTOR_MEDIA_SCAN_SIZE_INVALID');
        verdict = 'rejected';
      }

      const response = await fetch(input.uri, { cache: 'no-store' });
      if (!response.ok) throw new Error(`reference scan fetch failed: ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length !== input.sizeBytes) {
        reasons.push('DIRECTOR_MEDIA_SCAN_SIZE_MISMATCH');
        verdict = 'quarantine';
      }
      digest = sha256(bytes);

      const sharp = (await import('sharp')).default;
      const metadata = await sharp(bytes, {
        failOn: 'error',
        limitInputPixels: 16_384 * 16_384,
        sequentialRead: true,
      }).metadata();

      if (metadata.format !== 'png') {
        reasons.push('DIRECTOR_MEDIA_SCAN_DECODED_FORMAT_INVALID');
        verdict = 'rejected';
      }
      if (!metadata.width || !metadata.height || metadata.width < 512 || metadata.height < 512) {
        reasons.push('DIRECTOR_MEDIA_SCAN_DIMENSIONS_INVALID');
        verdict = 'rejected';
      }
      if (metadata.exif || metadata.icc || metadata.xmp) {
        reasons.push('DIRECTOR_MEDIA_SCAN_METADATA_PRESENT');
        verdict = 'needs_review';
      }
    } catch (error) {
      reasons.push(error instanceof Error ? error.message : 'DIRECTOR_MEDIA_SCAN_FAILED');
      verdict = 'quarantine';
    }

    if (verdict === 'clean') {
      reasons.push('DIRECTOR_MEDIA_SCAN_PIXEL_PNG_SECOND_DECODE_PASSED');
      reasons.push('DIRECTOR_MEDIA_SCAN_SOURCE_CONTAINER_DISCARDED');
    }

    return {
      assetId: input.assetId,
      sha256: digest,
      verdict,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      reasons,
      scannedAt: new Date().toISOString(),
    };
  }
}
