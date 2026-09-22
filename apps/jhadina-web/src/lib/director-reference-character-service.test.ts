import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { sanitizeDirectorReferenceImage } from './director-reference-character-service';

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
});
