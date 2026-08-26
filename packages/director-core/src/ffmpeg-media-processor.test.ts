import { describe, expect, it, vi } from 'vitest';
import { FfmpegMediaProcessor } from './ffmpeg-media-processor';

describe('FfmpegMediaProcessor', () => {
  it('executes FFmpeg through an injected runner and normalizes success', async () => {
    const run = vi.fn().mockResolvedValue({ exitCode: 0 });
    const processor = new FfmpegMediaProcessor(run);
    const result = await processor.process({
      requestId: 'req-1',
      projectId: 'project-1',
      inputUri: '/tmp/input.mov',
      outputUri: '/tmp/output.mp4',
      args: ['-c:v', 'libx264'],
    });
    expect(run).toHaveBeenCalledWith(['-y', '-i', '/tmp/input.mov', '-c:v', 'libx264', '/tmp/output.mp4']);
    expect(result).toEqual({ requestId: 'req-1', status: 'completed', outputUri: '/tmp/output.mp4' });
  });

  it('turns a non-zero FFmpeg exit into a failed media result', async () => {
    const processor = new FfmpegMediaProcessor(async () => ({ exitCode: 1, stderr: 'codec error' }));
    await expect(processor.process({ requestId: 'req-2', projectId: 'project-1', inputUri: 'in.mov', outputUri: 'out.mp4', args: [] }))
      .resolves.toEqual({ requestId: 'req-2', status: 'failed', error: 'codec error' });
  });
});
