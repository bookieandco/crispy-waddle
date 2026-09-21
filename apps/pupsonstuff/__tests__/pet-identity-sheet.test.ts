import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { buildPetIdentitySheet } from '../lib/pet-identity-sheet';

async function image(red: number, green: number, blue: number): Promise<Buffer> {
  return sharp({
    create: {
      width: 640,
      height: 800,
      channels: 3,
      background: { r: red, g: green, b: blue },
    },
  })
    .jpeg()
    .toBuffer();
}

describe('Pet Identity input composition', () => {
  it('uses every admitted reference instead of silently ignoring extras', async () => {
    const sheet = await buildPetIdentitySheet([
      { bytes: await image(255, 0, 0), mimeType: 'image/jpeg', role: 'primary', assetId: 'primary' },
      { bytes: await image(0, 255, 0), mimeType: 'image/jpeg', role: 'reference', assetId: 'side' },
      { bytes: await image(0, 0, 255), mimeType: 'image/jpeg', role: 'reference', assetId: 'detail' },
    ]);
    const meta = await sharp(sheet.bytes).metadata();
    expect(sheet.sourceAssetIds).toEqual(['primary', 'side', 'detail']);
    expect(meta.width).toBe(1608);
    expect(meta.height).toBe(1608);
  });

  it('normalizes a single strong photo without requiring extras', async () => {
    const sheet = await buildPetIdentitySheet([
      { bytes: await image(255, 0, 0), mimeType: 'image/jpeg', role: 'primary', assetId: 'primary' },
    ]);
    const meta = await sharp(sheet.bytes).metadata();
    expect(sheet.sourceAssetIds).toEqual(['primary']);
    expect(meta.width).toBe(1536);
    expect(meta.height).toBe(1536);
  });
});
