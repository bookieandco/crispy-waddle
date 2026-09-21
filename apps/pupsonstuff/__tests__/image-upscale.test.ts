import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { ensureSourceResolution } from '../lib/image-upscale';

async function png(size: number): Promise<Buffer> {
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 10, g: 20, b: 30, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
}

describe('image upscale boundary', () => {
  it('returns the original bytes when enough source detail already exists', async () => {
    const bytes = await png(1200);
    const result = await ensureSourceResolution({
      bytes,
      mimeType: 'image/png',
      requiredWidth: 900,
      requiredHeight: 900,
      env: { NODE_ENV: 'test' } as NodeJS.ProcessEnv,
    });
    expect(result.provider).toBe('none');
    expect(result.bytes).toEqual(bytes);
    expect(result.originalWidth).toBe(1200);
  });

  it('fails closed instead of pretending interpolation created detail', async () => {
    await expect(
      ensureSourceResolution({
        bytes: await png(400),
        mimeType: 'image/png',
        requiredWidth: 900,
        requiredHeight: 900,
        env: { NODE_ENV: 'test' } as NodeJS.ProcessEnv,
      })
    ).rejects.toThrow('Configure PUPSON_UPSCALER_URL or KNOCKOUT_TOKEN');
  });
});
