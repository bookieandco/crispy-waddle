import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { sanitizeDirectorReferenceImage } from './director-reference-character-service';
import { DirectorSanitizedImageScanner } from './director-reference-media-scanner';

async function png(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 30, g: 60, b: 90, alpha: 1 },
    },
  }).png().toBuffer();
}

describe('Director reference-character image admission', () => {
  it('decodes and losslessly normalizes an admitted image to metadata-free PNG', async () => {
    const source = await png(512, 640);
    const result = await sanitizeDirectorReferenceImage({
      fileName: 'character.png',
      mimeType: 'image/png',
      bytes: source,
    });

    expect(result.width).toBe(512);
    expect(result.height).toBe(640);
    expect(result.decodedMimeType).toBe('image/png');
    expect(result.bytes.subarray(1, 4).toString('ascii')).toBe('PNG');

    const metadata = await sharp(result.bytes).metadata();
    expect(metadata.format).toBe('png');
    expect(metadata.width).toBe(512);
    expect(metadata.height).toBe(640);
    expect(metadata.exif).toBeUndefined();
  });

  it('rejects unsupported containers before persistence', async () => {
    await expect(sanitizeDirectorReferenceImage({
      fileName: 'character.gif',
      mimeType: 'image/gif',
      bytes: Buffer.from('GIF89a'),
    })).rejects.toThrow('DIRECTOR_REFERENCE_MIME_UNSUPPORTED');
  });

  it('rejects declared MIME that does not match decoded pixels', async () => {
    const source = await png(512, 512);
    await expect(sanitizeDirectorReferenceImage({
      fileName: 'character.jpg',
      mimeType: 'image/jpeg',
      bytes: source,
    })).rejects.toThrow('DIRECTOR_REFERENCE_MIME_MISMATCH');
  });

  it('rejects references below the 512px identity floor', async () => {
    const source = await png(128, 128);
    await expect(sanitizeDirectorReferenceImage({
      fileName: 'tiny.png',
      mimeType: 'image/png',
      bytes: source,
    })).rejects.toThrow('DIRECTOR_REFERENCE_DIMENSIONS_INVALID');
  });

  it('rejects oversized source payloads before decoding', async () => {
    await expect(sanitizeDirectorReferenceImage({
      fileName: 'huge.png',
      mimeType: 'image/png',
      bytes: Buffer.alloc(10 * 1024 * 1024 + 1),
    })).rejects.toThrow('DIRECTOR_REFERENCE_SIZE_INVALID');
  });
  it('marks a second-decoded pixel-only PNG clean through the Security Core scanner', async () => {
    const source = await png(512, 512);
    const sanitized = await sanitizeDirectorReferenceImage({
      fileName: 'character.png',
      mimeType: 'image/png',
      bytes: source,
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(sanitized.bytes, {
      status: 200,
      headers: { 'content-type': 'image/png' },
    });

    try {
      const result = await new DirectorSanitizedImageScanner().scan({
        assetId: 'reference:1',
        uri: 'https://signed.example/reference.png',
        mimeType: 'image/png',
        sizeBytes: sanitized.bytes.length,
      });
      expect(result.verdict).toBe('clean');
      expect(result.sha256).toBe(createHash('sha256').update(sanitized.bytes).digest('hex'));
      expect(result.reasons).toContain('DIRECTOR_MEDIA_SCAN_PIXEL_PNG_SECOND_DECODE_PASSED');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('quarantines the normalized object when the scanner observes a byte-size mismatch', async () => {
    const source = await png(512, 512);
    const sanitized = await sanitizeDirectorReferenceImage({
      fileName: 'character.png',
      mimeType: 'image/png',
      bytes: source,
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(sanitized.bytes, { status: 200 });

    try {
      const result = await new DirectorSanitizedImageScanner().scan({
        assetId: 'reference:2',
        uri: 'https://signed.example/reference.png',
        mimeType: 'image/png',
        sizeBytes: sanitized.bytes.length + 1,
      });
      expect(result.verdict).toBe('quarantine');
      expect(result.reasons).toContain('DIRECTOR_MEDIA_SCAN_SIZE_MISMATCH');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
