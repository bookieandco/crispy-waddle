import { describe, expect, it } from 'vitest';
import { fingerprintDirectorPaidVideoGeneration } from './paid-video-generation';

const base = {
  jobId: 'video:1',
  userId: 'user-1',
  projectId: 'project-1',
  providerId: 'higgsfield-seedance-2-reference',
  prompt: 'Create an 8 second Zesta ad.',
  intent: { mode: 'short' as const, aspectRatio: '9:16' as const, targetDurationSeconds: 8 },
  character: {
    characterId: 'ela',
    continuityRef: 'character:ela:v1',
    appearanceVariantId: 'appearance:ela:base',
    referenceSha256s: ['char-b','char-a'],
  },
  product: {
    productId: 'zesta',
    productBibleId: 'product-bible:zesta:v1',
    canonicalVariantId: 'product-variant:zesta:base',
    referenceSha256s: ['product-b','product-a'],
    labelAuthorities: [
      { text: 'Bold Chili Kick', surface: 'front' },
      { text: 'ZESTA', surface: 'front' },
    ],
  },
};

describe('Director paid video generation fingerprint', () => {
  it('is stable across unordered reference/equivalent label input', () => {
    const first = fingerprintDirectorPaidVideoGeneration(base);
    const second = fingerprintDirectorPaidVideoGeneration({
      ...base,
      character: { ...base.character, referenceSha256s: ['char-a','char-b'] },
      product: {
        ...base.product,
        referenceSha256s: ['product-a','product-b'],
        labelAuthorities: [...base.product.labelAuthorities].reverse(),
      },
    });
    expect(first).toBe(second);
  });

  it('changes when provider, duration, prompt or identity changes', () => {
    const fingerprint = fingerprintDirectorPaidVideoGeneration(base);
    expect(fingerprintDirectorPaidVideoGeneration({ ...base, providerId: 'other' })).not.toBe(fingerprint);
    expect(fingerprintDirectorPaidVideoGeneration({ ...base, prompt: 'Different ad' })).not.toBe(fingerprint);
    expect(fingerprintDirectorPaidVideoGeneration({ ...base, intent: { ...base.intent, targetDurationSeconds: 12 } })).not.toBe(fingerprint);
    expect(fingerprintDirectorPaidVideoGeneration({
      ...base,
      product: { ...base.product, referenceSha256s: ['different'] },
    })).not.toBe(fingerprint);
  });
});
