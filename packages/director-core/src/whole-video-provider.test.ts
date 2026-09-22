import { describe, expect, it } from 'vitest';
import {
  selectWholeVideoProvider,
  type WholeVideoProductionProvider,
} from './whole-video-provider';

const intent = {
  mode: 'standard' as const,
  prompt: 'Create a video',
  aspectRatio: '16:9' as const,
  narration: true,
  captions: true,
  foley: true,
  commercialSafeOnly: true as const,
  providerPolicy: { localFreeFirst: true as const, allowPaidWithoutApproval: false as const },
};

function provider(
  id: string,
  input: { costClass?: 'free-local'|'external-free'|'paid'; character?: boolean; requiresCharacter?: boolean; product?: boolean; requiresProduct?: boolean } = {},
): WholeVideoProductionProvider {
  return {
    descriptor: {
      id,
      name: id,
      costClass: input.costClass ?? 'free-local',
      supportedModes: ['standard'],
      health: 'healthy',
      supportsCharacterReference: input.character ?? false,
      requiresCharacterReference: input.requiresCharacter ?? false,
      supportsProductReference: input.product ?? false,
      requiresProductReference: input.requiresProduct ?? false,
    },
    async submit() { return { providerJobId: 'job', status: 'queued' }; },
    async status() { return { providerJobId: 'job', status: 'processing' }; },
    async download() { return { bytes: new Uint8Array(), contentType: 'video/mp4' }; },
    async cancel() {},
  };
}

describe('whole video provider selection', () => {
  it('keeps generic video providers available for ordinary Ask Jhadina video jobs', () => {
    const selected = selectWholeVideoProvider([
      provider('generic-free'),
      provider('reference-free', { character: true, requiresCharacter: true }),
    ], intent);
    expect(selected?.descriptor.id).toBe('generic-free');
    expect(selectWholeVideoProvider([provider('reference-only', { character: true, requiresCharacter: true })], intent)).toBeUndefined();
  });

  it('refuses generic providers when a locked reference character is required', () => {
    const selected = selectWholeVideoProvider([
      provider('generic-free'),
      provider('reference-free', { character: true, requiresCharacter: true }),
    ], intent, { characterReference: true });
    expect(selected?.descriptor.id).toBe('reference-free');
  });

  it('requires a product-aware provider when a locked product reference is present', () => {
    const selected = selectWholeVideoProvider([
      provider('generic-free'),
      provider('reference-free', { product: true }),
    ], intent, { productReference: true });
    expect(selected?.descriptor.id).toBe('reference-free');
    expect(selectWholeVideoProvider([provider('generic-free')], intent, { productReference: true })).toBeUndefined();
  });

  it('returns no provider instead of losing character identity', () => {
    expect(selectWholeVideoProvider([
      provider('generic-free'),
      provider('generic-paid', { costClass: 'paid' }),
    ], intent, { characterReference: true })).toBeUndefined();
  });
});
