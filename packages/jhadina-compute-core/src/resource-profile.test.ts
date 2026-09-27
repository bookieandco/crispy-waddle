import { describe, expect, it } from 'vitest';
import {
  resolveComputeWorkload,
  validateResourceProfile,
  type ComputeResourceProfileCatalog,
  type ComputeWorkloadDraft,
} from './resource-profile.js';

const profiles: ComputeResourceProfileCatalog = {
  'director.video.local': {
    id: 'director.video.local',
    allowedKinds: ['video-generation'],
    resources: {
      cpuCores: 8,
      ramGiB: 32,
      scratchGiB: 200,
      gpu: { vendor: 'nvidia', count: 1, minVramGiBPerDevice: 24 },
    },
  },
};

const draft: ComputeWorkloadDraft = {
  id: 'compute:generation-1',
  source: 'director',
  kind: 'video-generation',
  authority: {
    system: 'director-generation',
    jobId: 'generation-1',
    idempotencyKey: 'generation-1',
    projectId: 'movie-1',
  },
  resourceProfileId: 'director.video.local',
  constraints: { sensitiveData: true },
  dataLocalityKeys: ['asset:scene-1', 'asset:scene-1'],
  createdAt: '2026-09-27T00:00:00.000Z',
};

describe('resource profiles', () => {
  it('resolves deployment sizing while preserving authority and privacy constraints', () => {
    const workload = resolveComputeWorkload(draft, profiles);
    expect(workload.authority).toEqual(draft.authority);
    expect(workload.resourceProfileId).toBe('director.video.local');
    expect(workload.resources.gpu?.minVramGiBPerDevice).toBe(24);
    expect(workload.resources.sensitiveData).toBe(true);
    expect(workload.resources.allowCloudBurst).toBeUndefined();
    expect(workload.queue).toBe('creative');
    expect(workload.priority).toBe(700);
    expect(workload.dataLocalityKeys).toEqual(['asset:scene-1']);
  });

  it('fails closed when the profile does not exist', () => {
    expect(() =>
      resolveComputeWorkload({ ...draft, resourceProfileId: 'missing' }, profiles),
    ).toThrow('COMPUTE_RESOURCE_PROFILE_NOT_FOUND:missing');
  });

  it('fails closed when a profile is used for the wrong kind', () => {
    expect(() =>
      resolveComputeWorkload({ ...draft, kind: 'image-generation' }, profiles),
    ).toThrow('COMPUTE_RESOURCE_PROFILE_KIND_MISMATCH:image-generation');
  });

  it('requires durable authority lineage', () => {
    expect(() =>
      resolveComputeWorkload(
        {
          ...draft,
          authority: { ...draft.authority, idempotencyKey: '' },
        },
        profiles,
      ),
    ).toThrow('COMPUTE_AUTHORITY_LINEAGE_REQUIRED');
  });

  it('rejects malformed deployment resource profiles', () => {
    expect(
      validateResourceProfile({
        id: 'bad',
        allowedKinds: ['video-generation'],
        resources: { cpuCores: 0, ramGiB: 0, scratchGiB: -1 },
      }),
    ).toEqual([
      'COMPUTE_PROFILE_CPU_INVALID',
      'COMPUTE_PROFILE_RAM_INVALID',
      'COMPUTE_PROFILE_SCRATCH_INVALID',
    ]);
  });

  it('does not invent cloud burst when a workload omits it', () => {
    const workload = resolveComputeWorkload(
      { ...draft, constraints: { sensitiveData: false } },
      profiles,
    );
    expect(workload.resources.allowCloudBurst).toBeUndefined();
  });
});
