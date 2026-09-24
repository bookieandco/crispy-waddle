export type FinishingEffectKind =
  | 'chromatic-aberration'
  | 'sharpen'
  | 'bloom'
  | 'grain';

export interface FinishingEffect {
  kind: FinishingEffectKind;
  strength: number;
  purpose: string;
}

export interface VideoUpscaleChunk {
  id: string;
  startFrame: number;
  endFrameExclusive: number;
  sourceAssetId: string;
}

export interface VideoUpscalePlan {
  id: string;
  projectId: string;
  sourceAssetId: string;
  sourceWidth: number;
  sourceHeight: number;
  targetWidth: number;
  targetHeight: number;
  fps: number;
  frameCount: number;
  maxFramesPerChunk: number;
  chunks: readonly VideoUpscaleChunk[];
  preserveAudio: boolean;
  preserveFrameCount: true;
  preserveTiming: true;
  effects: readonly FinishingEffect[];
  authority: 'DIRECTOR_VIDEO_UPSCALE_PLAN';
}

export interface VideoUpscaleResult {
  planId: string;
  outputAssetId: string;
  width: number;
  height: number;
  fps: number;
  frameCount: number;
  audioPreserved: boolean;
  chunkArtifactIds: readonly string[];
  evidenceIds: readonly string[];
}

export function planChunkedVideoUpscale(input: {
  id: string;
  projectId: string;
  sourceAssetId: string;
  sourceWidth: number;
  sourceHeight: number;
  targetWidth: number;
  targetHeight: number;
  fps: number;
  frameCount: number;
  maxFramesPerChunk: number;
  preserveAudio?: boolean;
  effects?: readonly FinishingEffect[];
}): VideoUpscalePlan {
  const reasons: string[] = [];
  if (!input.id.trim() || !input.projectId.trim() || !input.sourceAssetId.trim()) {
    reasons.push('DIRECTOR_UPSCALE_IDENTITY_REQUIRED');
  }
  for (const [name, value] of [
    ['sourceWidth', input.sourceWidth],
    ['sourceHeight', input.sourceHeight],
    ['targetWidth', input.targetWidth],
    ['targetHeight', input.targetHeight],
    ['frameCount', input.frameCount],
    ['maxFramesPerChunk', input.maxFramesPerChunk],
  ] as const) {
    if (!Number.isInteger(value) || value <= 0) reasons.push(`DIRECTOR_UPSCALE_${name.toUpperCase()}_INVALID`);
  }
  if (!Number.isFinite(input.fps) || input.fps <= 0) reasons.push('DIRECTOR_UPSCALE_FPS_INVALID');
  if (
    Number.isFinite(input.sourceWidth) &&
    Number.isFinite(input.sourceHeight) &&
    Number.isFinite(input.targetWidth) &&
    Number.isFinite(input.targetHeight) &&
    (input.targetWidth < input.sourceWidth || input.targetHeight < input.sourceHeight)
  ) {
    reasons.push('DIRECTOR_UPSCALE_TARGET_SMALLER_THAN_SOURCE');
  }

  for (const effect of input.effects ?? []) {
    if (!Number.isFinite(effect.strength) || effect.strength < 0 || effect.strength > 1 || !effect.purpose.trim()) {
      reasons.push(`DIRECTOR_FINISHING_EFFECT_INVALID:${effect.kind}`);
    }
  }

  if (reasons.length) throw new Error(`DIRECTOR_VIDEO_UPSCALE_PLAN_INVALID: ${[...new Set(reasons)].join(', ')}`);

  const chunks: VideoUpscaleChunk[] = [];
  for (let start = 0; start < input.frameCount; start += input.maxFramesPerChunk) {
    chunks.push(Object.freeze({
      id: `${input.id}:chunk:${chunks.length + 1}`,
      startFrame: start,
      endFrameExclusive: Math.min(input.frameCount, start + input.maxFramesPerChunk),
      sourceAssetId: input.sourceAssetId,
    }));
  }

  return Object.freeze({
    id: input.id,
    projectId: input.projectId,
    sourceAssetId: input.sourceAssetId,
    sourceWidth: input.sourceWidth,
    sourceHeight: input.sourceHeight,
    targetWidth: input.targetWidth,
    targetHeight: input.targetHeight,
    fps: input.fps,
    frameCount: input.frameCount,
    maxFramesPerChunk: input.maxFramesPerChunk,
    chunks: Object.freeze(chunks),
    preserveAudio: input.preserveAudio !== false,
    preserveFrameCount: true,
    preserveTiming: true,
    effects: Object.freeze([...(input.effects ?? [])]),
    authority: 'DIRECTOR_VIDEO_UPSCALE_PLAN',
  });
}

export function validateVideoUpscalePlan(plan: VideoUpscalePlan): readonly string[] {
  const reasons: string[] = [];
  if (!plan.chunks.length) reasons.push('DIRECTOR_UPSCALE_CHUNKS_REQUIRED');

  let cursor = 0;
  for (const chunk of plan.chunks) {
    if (
      !Number.isInteger(chunk.startFrame) ||
      !Number.isInteger(chunk.endFrameExclusive) ||
      chunk.startFrame !== cursor ||
      chunk.endFrameExclusive <= chunk.startFrame ||
      chunk.endFrameExclusive > plan.frameCount
    ) {
      reasons.push(`DIRECTOR_UPSCALE_CHUNK_RANGE_INVALID:${chunk.id}`);
      break;
    }
    if (chunk.endFrameExclusive - chunk.startFrame > plan.maxFramesPerChunk) {
      reasons.push(`DIRECTOR_UPSCALE_CHUNK_TOO_LARGE:${chunk.id}`);
    }
    if (chunk.sourceAssetId !== plan.sourceAssetId) {
      reasons.push(`DIRECTOR_UPSCALE_CHUNK_SOURCE_MISMATCH:${chunk.id}`);
    }
    cursor = chunk.endFrameExclusive;
  }
  if (cursor !== plan.frameCount) reasons.push('DIRECTOR_UPSCALE_FRAME_COVERAGE_MISMATCH');

  return Object.freeze([...new Set(reasons)]);
}

export function validateVideoUpscaleResult(
  plan: VideoUpscalePlan,
  result: VideoUpscaleResult,
): readonly string[] {
  const reasons: string[] = [];
  if (result.planId !== plan.id) reasons.push('DIRECTOR_UPSCALE_RESULT_PLAN_MISMATCH');
  if (result.width !== plan.targetWidth || result.height !== plan.targetHeight) {
    reasons.push('DIRECTOR_UPSCALE_RESULT_DIMENSION_MISMATCH');
  }
  if (!Number.isFinite(result.fps) || Math.abs(result.fps - plan.fps) > 1e-6) {
    reasons.push('DIRECTOR_UPSCALE_RESULT_FPS_MISMATCH');
  }
  if (result.frameCount !== plan.frameCount) reasons.push('DIRECTOR_UPSCALE_RESULT_FRAME_COUNT_MISMATCH');
  if (plan.preserveAudio && !result.audioPreserved) reasons.push('DIRECTOR_UPSCALE_RESULT_AUDIO_DROPPED');
  if (result.chunkArtifactIds.length !== plan.chunks.length) reasons.push('DIRECTOR_UPSCALE_RESULT_CHUNK_COUNT_MISMATCH');
  if (!result.outputAssetId.trim() || !result.evidenceIds.length) reasons.push('DIRECTOR_UPSCALE_RESULT_EVIDENCE_REQUIRED');
  return Object.freeze([...new Set(reasons)]);
}
