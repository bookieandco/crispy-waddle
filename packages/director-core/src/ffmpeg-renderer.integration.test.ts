import { describe, expect, it } from 'vitest';
import { buildFfmpegRenderCommand } from './ffmpeg-command-builder.js';
import type { FFmpegRenderPlan } from './ffmpeg-render-plan.js';

describe('FFmpeg renderer contract', () => {
  it('maps video and each independent audio role explicitly', () => {
    const plan = {
      inputs: [
        { path: '/media/video.mov', clipIds: ['video-1'] },
        { path: '/media/dialogue.wav', clipIds: ['dialogue-1'] },
        { path: '/media/music.wav', clipIds: ['music-1'] },
        { path: '/media/sfx.wav', clipIds: ['sfx-1'] },
        { path: '/media/foley.wav', clipIds: ['foley-1'] },
      ],
      filterComplex: '[0:v]null[vout];[1:a]anull[d];[2:a]anull[m];[3:a]anull[s];[4:a]anull[f];[d][m][s][f]amix=inputs=4:duration=longest[aout]',
      maps: ['[vout]', '[aout]'],
      outputPath: '/renders/final.mp4',
      videoCodec: 'libx264',
      audioCodec: 'aac',
      container: 'mp4',
    } as FFmpegRenderPlan;

    const command = buildFfmpegRenderCommand(plan);
    expect(command).toContain('-filter_complex');
    expect(command).toContain('[vout]');
    expect(command).toContain('[aout]');
    expect(command).toContain('/renders/final.mp4');
  });
});
