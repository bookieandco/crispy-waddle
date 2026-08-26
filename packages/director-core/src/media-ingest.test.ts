import { describe, expect, it, vi } from 'vitest';
import { MediaIngestService } from './media-ingest';

describe('MediaIngestService', () => {
  it('probes, registers the source, and creates a CPU-friendly proxy job', async () => {
    const probe = vi.fn().mockResolvedValue({ durationSeconds: 12, width: 3840, height: 2160, frameRate: 30 });
    const register = vi.fn().mockImplementation(async (asset) => asset);
    const process = vi.fn().mockResolvedValue({ requestId: 'asset-1:proxy:preview-720p', status: 'completed', outputUri: '/media/proxy.mp4' });
    const service = new MediaIngestService({ id: 'probe', probe }, { id: 'ffmpeg', process }, { register });

    const result = await service.ingest({ projectId: 'project-1', assetId: 'asset-1', inputUri: '/media/source.mov', proxyProfile: 'preview-720p', proxyOutputUri: '/media/proxy.mp4' });

    expect(probe).toHaveBeenCalledWith('/media/source.mov');
    expect(register).toHaveBeenCalledWith(expect.objectContaining({ id: 'asset-1', uri: '/media/source.mov', metadata: expect.objectContaining({ width: 3840 }) }));
    expect(process).toHaveBeenCalledWith(expect.objectContaining({ inputUri: '/media/source.mov', outputUri: '/media/proxy.mp4', args: expect.arrayContaining(['scale=-2:720']) }));
    expect(result.proxyJob.status).toBe('completed');
  });

  it('marks the proxy job failed when processing fails', async () => {
    const process = vi.fn().mockResolvedValue({ requestId: 'asset-1:proxy:preview-540p', status: 'failed', error: 'ffmpeg failed' });
    const service = new MediaIngestService({ id: 'probe', probe: async () => ({}) }, { id: 'ffmpeg', process }, { register: async (asset) => asset });
    const result = await service.ingest({ projectId: 'project-1', assetId: 'asset-1', inputUri: 'source.mov', proxyProfile: 'preview-540p', proxyOutputUri: 'proxy.mp4' });
    expect(result.proxyJob.status).toBe('failed');
  });
});
