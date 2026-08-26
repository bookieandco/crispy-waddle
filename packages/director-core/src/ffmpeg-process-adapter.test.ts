import { describe, expect, it } from 'vitest';
import { createNodeFfmpegDecoder } from './ffmpeg-process-adapter.js';

describe('createNodeFfmpegDecoder', () => {
  it('creates a decoder with injectable process execution', () => {
    const calls: string[][] = [];
    const decoder = createNodeFfmpegDecoder((args) => {
      calls.push(args);
      throw new Error('test process');
    });

    expect(decoder).toBeDefined();
    expect(decoder.decodeFrames({ source: 'sample.mp4', assetId: 'asset-1' })).toBeDefined();
    expect(calls).toEqual([]);
  });
});
