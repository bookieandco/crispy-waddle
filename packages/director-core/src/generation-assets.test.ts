import { describe, expect, it } from 'vitest';
import { InMemoryGeneratedAssetRepository } from './generation-assets';

describe('GeneratedAssetRepository', () => {
  it('persists and queries generated assets without exposing storage details', async () => {
    const repository = new InMemoryGeneratedAssetRepository();
    await repository.save({
      id: 'asset-1',
      projectId: 'project-1',
      generationJobId: 'job-1',
      kind: 'video',
      uri: 's3://example/take.mp4',
      mimeType: 'video/mp4',
      modelId: 'video-model',
      workflowId: 'txt2video/v1',
      createdAt: '2026-08-26T00:00:00.000Z',
    });

    expect((await repository.get('asset-1'))?.uri).toBe('s3://example/take.mp4');
    expect((await repository.listByGenerationJob('job-1'))).toHaveLength(1);
    expect((await repository.listByProject('project-1'))).toHaveLength(1);
    expect(await repository.listByProject('other-project')).toEqual([]);
  });
});
