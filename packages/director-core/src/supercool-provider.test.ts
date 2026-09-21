import { describe, expect, it } from 'vitest';
import { createSuperCoolProvider, toSuperCoolRequest } from './supercool-provider.js';
import type { TakeRequest } from './generation-orchestrator.js';

const request: TakeRequest = {
  projectId: 'film-1',
  sceneId: 'scene-4',
  prompt: 'A slow push-in as the detective realizes the truth.',
  targetRuntimeSeconds: 8,
  sceneCount: 1,
  takeCount: 2,
  locked: ['character', 'location', 'camera'],
  referenceCharacterIds: ['detective'],
  referenceAssetIds: ['office'],
  cinematography: { id: 'noir', name: 'Neo-Noir', shot: 'medium', lens: '50mm' },
};

describe('SuperCool provider', () => {
  it('preserves DirectorOS continuity and approval state', () => {
    expect(toSuperCoolRequest(request)).toMatchObject({
      projectId: 'film-1',
      sceneId: 'scene-4',
      prompt: request.prompt,
      targetRuntimeSeconds: 8,
      continuity: {
        locks: ['character', 'location', 'camera'],
        characterReferences: ['detective'],
        assetReferences: ['office'],
      },
      approvalRequired: true,
    });
  });

  it('delegates generation through the injected transport', async () => {
    const calls: unknown[] = [];
    const provider = createSuperCoolProvider({
      async submit(input) {
        calls.push(input);
        return {
          provider: 'supercool',
          providerJobId: 'job-123',
          media: { kind: 'video', uri: 'https://example.test/take.mp4', durationSeconds: 8 },
        };
      },
    });

    const result = await provider.generate({ ...request, variation: 'take-b' });

    expect(calls).toHaveLength(1);
    expect(result).toMatchObject({ provider: 'supercool', providerJobId: 'job-123' });
    expect(result.media.uri).toBe('https://example.test/take.mp4');
  });
});
