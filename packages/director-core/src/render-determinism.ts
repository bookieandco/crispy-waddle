export interface FrameExactRenderContract {
  fps: number;
  width: number;
  height: number;
  durationSeconds: number;
  pureSeekRequired: true;
}

export interface FrameRenderSample {
  timeSeconds: number;
  frameSha256: string;
}

export interface FrameDeterminismDecision {
  deterministic: boolean;
  reasons: readonly string[];
  frameCount?: number;
}

export function validateFrameExactRenderContract(contract: FrameExactRenderContract): FrameDeterminismDecision {
  const reasons: string[] = [];
  if (!Number.isFinite(contract.fps) || contract.fps <= 0) reasons.push('DIRECTOR_RENDER_FPS_INVALID');
  if (!Number.isInteger(contract.width) || contract.width <= 0) reasons.push('DIRECTOR_RENDER_WIDTH_INVALID');
  if (!Number.isInteger(contract.height) || contract.height <= 0) reasons.push('DIRECTOR_RENDER_HEIGHT_INVALID');
  if (!Number.isFinite(contract.durationSeconds) || contract.durationSeconds <= 0) reasons.push('DIRECTOR_RENDER_DURATION_INVALID');

  const rawFrames = contract.durationSeconds * contract.fps;
  const frameCount = Math.round(rawFrames);
  if (Math.abs(rawFrames - frameCount) > 1e-6) {
    reasons.push('DIRECTOR_RENDER_DURATION_NOT_FRAME_EXACT');
  }

  return Object.freeze({
    deterministic: reasons.length === 0,
    reasons: Object.freeze(reasons),
    ...(reasons.length === 0 ? { frameCount } : {}),
  });
}

/**
 * A repeated request for the same timeline time must return the same frame
 * digest. This detects hidden mutable render state without prescribing any
 * particular rendering engine.
 */
export function verifyPureSeekSamples(samples: readonly FrameRenderSample[]): FrameDeterminismDecision {
  const reasons: string[] = [];
  const byTime = new Map<number, string>();

  for (const sample of samples) {
    if (!Number.isFinite(sample.timeSeconds) || sample.timeSeconds < 0 || !sample.frameSha256.trim()) {
      reasons.push('DIRECTOR_RENDER_SAMPLE_INVALID');
      continue;
    }
    const prior = byTime.get(sample.timeSeconds);
    if (prior && prior !== sample.frameSha256) reasons.push('DIRECTOR_RENDER_HIDDEN_STATE_DETECTED');
    else byTime.set(sample.timeSeconds, sample.frameSha256);
  }

  return Object.freeze({
    deterministic: reasons.length === 0,
    reasons: Object.freeze([...new Set(reasons)]),
  });
}
