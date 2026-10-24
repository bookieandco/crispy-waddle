import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { sanitizePetReference } from '../lib/pet-photo-safety';
import { assertCreativeReady } from '../lib/creative-readiness';

describe('owner-authorized creative activation', () => {
  it('rejects default-disabled generation even for local deterministic art', () => {
    expect(() => assertCreativeReady('ascii-art', 'keep', {}))
      .toThrow(/not activated/);
  });
  it('allows offline no-charge ASCII only after creative activation and keep selection', () => {
    expect(assertCreativeReady('ascii-art','keep',{
      PUPSON_CREATIVE_JOBS_ENABLED:'true'
    })).toMatchObject({provider:'local'});
  });
  it('never treats a credential as permission to spend', () => {
    const env = {PUPSON_CREATIVE_JOBS_ENABLED:'true', OPENAI_API_KEY:'secret-placeholder'};
    expect(() => assertCreativeReady('watercolor','keep',env))
      .toThrow(/owner approval/);
    expect(assertCreativeReady('watercolor','keep',{
      ...env,PUPSON_REMOTE_CREATIVE_APPROVED:'true'
    })).toMatchObject({provider:'openai'});
  });
  it('rejects removing a background without explicit approval and a remover', () => {
    const env = {PUPSON_CREATIVE_JOBS_ENABLED:'true'};
    expect(() => assertCreativeReady('ascii-art','auto',env)).toThrow(/configured/);
    expect(() => assertCreativeReady('ascii-art','auto',{
      ...env,PUPSON_BACKGROUND_REMOVER_URL:'https://private.example/remove'
    })).toThrow(/approval/);
  });
});

describe('privacy-preserving pet photo normalization', () => {
  it('strips EXIF/camera metadata while producing reusable still JPEG', async () => {
    const withExif = await sharp({
      create:{width:700,height:640,channels:3,background:{r:128,g:92,b:52}},
    }).jpeg().withMetadata({orientation:6}).toBuffer();
    const original = await sharp(withExif).metadata();
    expect(original.exif).toBeDefined();
    const sanitized = await sanitizePetReference({bytes:withExif,mimeType:'image/jpeg'});
    const meta = await sharp(sanitized.bytes).metadata();
    expect(sanitized.mimeType).toBe('image/jpeg');
    expect(meta.format).toBe('jpeg');
    expect(meta.exif).toBeUndefined();
    expect(meta.width).toBeGreaterThanOrEqual(512);
    expect(meta.height).toBeGreaterThanOrEqual(512);
  });
  it('rejects invalid sources before any storage call', async () => {
    await expect(sanitizePetReference({bytes:Buffer.alloc(10*1024*1024+1),mimeType:'image/jpeg'}))
      .rejects.toThrow(/10MB/);
    const tiny = await sharp({create:{width:240,height:240,channels:3,background:'#bbbbbb'}})
      .png().toBuffer();
    await expect(sanitizePetReference({bytes:tiny,mimeType:'image/png'}))
      .rejects.toThrow(/512/);
  });
});
