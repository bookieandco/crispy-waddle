import { describe, expect, it } from 'vitest';
import {
  planChunkedVideoUpscale,
  validateVideoUpscalePlan,
  validateVideoUpscaleResult,
} from './video-upscale-finishing.js';

describe('video upscale finishing', () => {
  it('splits a long render into frame-exact low-memory chunks', () => {
    const plan = planChunkedVideoUpscale({
      id: 'upscale:shot-1',
      projectId: 'movie-1',
      sourceAssetId: 'render:1080p',
      sourceWidth: 1920,
      sourceHeight: 1080,
      targetWidth: 3840,
      targetHeight: 2160,
      fps: 24,
      frameCount: 241,
      maxFramesPerChunk: 60,
      effects: [
        { kind: 'grain', strength: 0.12, purpose: 'subtle cinematic texture' },
        { kind: 'bloom', strength: 0.08, purpose: 'soft highlight rolloff' },
      ],
    });

    expect(plan.chunks.map((chunk) => [chunk.startFrame, chunk.endFrameExclusive])).toEqual([
      [0, 60],
      [60, 120],
      [120, 180],
      [180, 240],
      [240, 241],
    ]);
    expect(validateVideoUpscalePlan(plan)).toEqual([]);
  });

  it('rejects frame gaps or oversized chunks', () => {
    const plan = planChunkedVideoUpscale({
      id: 'upscale:shot-2',
      projectId: 'movie-1',
      sourceAssetId: 'render:1080p',
      sourceWidth: 1920,
      sourceHeight: 1080,
      targetWidth: 3840,
      targetHeight: 2160,
      fps: 24,
      frameCount: 120,
      maxFramesPerChunk: 60,
    });

    const invalid = {
      ...plan,
      chunks: [
        { ...plan.chunks[0]!, endFrameExclusive: 50 },
        { ...plan.chunks[1]!, startFrame: 60 },
      ],
    };

    expect(validateVideoUpscalePlan(invalid)).toEqual(expect.arrayContaining([
      expect.stringContaining('DIRECTOR_UPSCALE_CHUNK_RANGE_INVALID'),
      'DIRECTOR_UPSCALE_FRAME_COVERAGE_MISMATCH',
    ]));
  });

  it('rejects finishing effects with invalid strength', () => {
    expect(() => planChunkedVideoUpscale({
      id: 'upscale:bad-effect',
      projectId: 'movie-1',
      sourceAssetId: 'render:1080p',
      sourceWidth: 1920,
      sourceHeight: 1080,
      targetWidth: 3840,
      targetHeight: 2160,
      fps: 24,
      frameCount: 48,
      maxFramesPerChunk: 24,
      effects: [{ kind: 'chromatic-aberration', strength: 1.5, purpose: 'edge imperfection' }],
    })).toThrow('DIRECTOR_FINISHING_EFFECT_INVALID:chromatic-aberration');
  });

  it('requires the upscale result to preserve governed timing, frame count and audio', () => {
    const plan = planChunkedVideoUpscale({
      id: 'upscale:shot-3',
      projectId: 'movie-1',
      sourceAssetId: 'render:1080p',
      sourceWidth: 1920,
      sourceHeight: 1080,
      targetWidth: 3840,
      targetHeight: 2160,
      fps: 24,
      frameCount: 120,
      maxFramesPerChunk: 30,
      preserveAudio: true,
    });

    expect(validateVideoUpscaleResult(plan, {
      planId: plan.id,
      outputAssetId: 'render:4k',
      width: 3840,
      height: 2160,
      fps: 24,
      frameCount: 120,
      audioPreserved: true,
      chunkArtifactIds: plan.chunks.map((chunk) => `artifact:${chunk.id}`),
      evidenceIds: ['ffmpeg:probe', 'upscale:receipt'],
    })).toEqual([]);
  });

  it('fails if 4K finishing changes frame timing or drops audio', () => {
    const plan = planChunkedVideoUpscale({
      id: 'upscale:shot-4',
      projectId: 'movie-1',
      sourceAssetId: 'render:1080p',
      sourceWidth: 1920,
      sourceHeight: 1080,
      targetWidth: 3840,
      targetHeight: 2160,
      fps: 24,
      frameCount: 120,
      maxFramesPerChunk: 30,
    });

    const reasons = validateVideoUpscaleResult(plan, {
      planId: plan.id,
      outputAssetId: 'render:bad',
      width: 3840,
      height: 2160,
      fps: 23.976,
      frameCount: 119,
      audioPreserved: false,
      chunkArtifactIds: [],
      evidenceIds: ['qc:bad'],
    });

    expect(reasons).toEqual(expect.arrayContaining([
      'DIRECTOR_UPSCALE_RESULT_FPS_MISMATCH',
      'DIRECTOR_UPSCALE_RESULT_FRAME_COUNT_MISMATCH',
      'DIRECTOR_UPSCALE_RESULT_AUDIO_DROPPED',
      'DIRECTOR_UPSCALE_RESULT_CHUNK_COUNT_MISMATCH',
    ]));
  });
});
