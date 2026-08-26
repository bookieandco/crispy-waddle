import { describe, expect, it } from 'vitest';
import { approvedEditingAssets, toEditingAssetManifestEntry } from './editing-asset-manifest';
import type { GeneratedAssetRecord } from './generated-asset-resolver';

describe('editing asset manifest', () => {
  const asset: GeneratedAssetRecord = {
    id: 'generation:counter:asset:1',
    projectId: 'project-1',
    generationJobId: 'generation:counter',
    providerId: 'srt-counter',
    mediaType: 'subtitle',
    uri: 'data:text/plain;base64,AAA=',
    mimeType: 'application/x-subrip',
    modelId: 'director-srt-counter',
    createdAt: '2026-08-25T00:00:00.000Z',
    metadata: {
      operation: 'srt-counter',
      operationId: 'counter-operation-1',
      sourceId: 'raw-video-1',
      startSeconds: 12,
      endSeconds: 22,
    },
  };

  it('keeps generated metadata and requires explicit approval for usability', () => {
    const entry = toEditingAssetManifestEntry(asset);
    expect(entry.status).toBe('ready');
    expect(entry.usable).toBe(false);
    expect(entry.kind).toBe('subtitle');
    expect(entry.generationJobId).toBe('generation:counter');
    expect(entry.uri).toBe(asset.uri);
    expect(entry.mimeType).toBe('application/x-subrip');
    expect(entry.operationId).toBe('counter-operation-1');
    expect(entry.startSeconds).toBe(12);
    expect(entry.endSeconds).toBe(22);
  });

  it('projects only explicitly approved assets as usable editing assets', () => {
    const [entry] = approvedEditingAssets([asset], new Set([asset.id]));
    expect(entry.status).toBe('approved');
    expect(entry.usable).toBe(true);
    expect(entry.uri).toBe(asset.uri);
    expect(entry.mimeType).toBe('application/x-subrip');
  });

  it('leaves unapproved assets ready but unusable', () => {
    const [entry] = approvedEditingAssets([asset], new Set());
    expect(entry.status).toBe('ready');
    expect(entry.usable).toBe(false);
  });
});
