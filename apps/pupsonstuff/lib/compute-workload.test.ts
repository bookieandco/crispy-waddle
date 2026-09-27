import { describe, expect, it } from 'vitest';
import {
  podCreativeComputeDraft,
  pupsonCreativeComputeDraft,
} from './compute-workload';

describe('PupsonStuff compute workload adapters', () => {
  it('keeps pet creative jobs sensitive and local-first', () => {
    const draft = pupsonCreativeComputeDraft({
      jobId: 'job-1',
      idempotencyKey: 'idem-1',
      petIdentityId: 'pet-1',
      productId: 'shirt-1',
      artStyle: 'comic',
      sourceAssetIds: ['photo-1', 'photo-2'],
      profileId: 'pupson.image.default',
      createdAt: '2026-09-27T01:00:00.000Z',
    });
    expect(draft.authority).toEqual({
      system: 'pupson-creative-job',
      jobId: 'job-1',
      idempotencyKey: 'idem-1',
    });
    expect(draft.constraints?.sensitiveData).toBe(true);
    expect(draft.constraints?.allowCloudBurst).toBeUndefined();
    expect(draft.dataLocalityKeys).toContain('pet-identity:pet-1');
    expect(draft.dataLocalityKeys).toContain('asset:photo-2');
  });

  it('keeps generalized POD separate and explicit about cloud eligibility', () => {
    const draft = podCreativeComputeDraft({
      jobId: 'pod-1',
      idempotencyKey: 'pod-idem-1',
      productId: 'poster-1',
      sourceAssetIds: ['art-1'],
      profileId: 'pod.image.default',
      sensitiveData: false,
      allowCloudBurst: true,
      maxCostUsdPerHour: 2,
      createdAt: '2026-09-27T01:00:00.000Z',
    });
    expect(draft.source).toBe('pod');
    expect(draft.constraints).toEqual({
      sensitiveData: false,
      allowCloudBurst: true,
      maxCostUsdPerHour: 2,
    });
  });
});
