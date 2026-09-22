export type FfmpegLicenseMode = 'lgpl' | 'gpl' | 'nonfree';

export interface FfmpegRuntimeProfile {
  version: string;
  configuration: string;
  licenseMode: FfmpegLicenseMode;
  ffmpegPath: string;
  ffprobePath: string;
}

export interface FfmpegRuntimePolicy {
  redistributableDeployment: boolean;
  allowGplRuntime: boolean;
}

export interface FfmpegRuntimeDecision {
  admissible: boolean;
  reasons: readonly string[];
}

/**
 * FFmpeg itself is mainly LGPL, but the effective license changes with build
 * flags/external libraries. Director records that runtime fact instead of
 * assuming every ffmpeg binary has the same obligations.
 */
export function validateFfmpegRuntimeProfile(
  profile: FfmpegRuntimeProfile,
  policy: FfmpegRuntimePolicy,
): FfmpegRuntimeDecision {
  const reasons: string[] = [];
  if (!profile.version.trim() || !profile.configuration.trim()) reasons.push('DIRECTOR_FFMPEG_RUNTIME_PROVENANCE_REQUIRED');
  if (!profile.ffmpegPath.trim() || !profile.ffprobePath.trim()) reasons.push('DIRECTOR_FFMPEG_BINARY_PATH_REQUIRED');
  if (policy.redistributableDeployment && profile.licenseMode === 'nonfree') {
    reasons.push('DIRECTOR_FFMPEG_NONFREE_REDISTRIBUTION_BLOCKED');
  }
  if (!policy.allowGplRuntime && profile.licenseMode === 'gpl') {
    reasons.push('DIRECTOR_FFMPEG_GPL_RUNTIME_NOT_ADMITTED');
  }
  return Object.freeze({ admissible: reasons.length === 0, reasons: Object.freeze(reasons) });
}

export interface MediaProbe {
  durationSeconds: number;
  width?: number;
  height?: number;
  fps?: number;
  videoCodec?: string;
  audioCodec?: string;
  audioSampleRateHz?: number;
  audioChannels?: number;
  hasVideo: boolean;
  hasAudio: boolean;
}

export interface FinalMediaExpectation {
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
  requireVideo: boolean;
  requireAudio: boolean;
  maximumDurationDriftSeconds: number;
  permittedVideoCodecs?: readonly string[];
  permittedAudioCodecs?: readonly string[];
}

export interface FinalMediaProbeDecision {
  admissible: boolean;
  reasons: readonly string[];
}

export function validateFinalMediaProbe(
  probe: MediaProbe,
  expected: FinalMediaExpectation,
): FinalMediaProbeDecision {
  const reasons: string[] = [];
  if (expected.requireVideo && !probe.hasVideo) reasons.push('DIRECTOR_MEDIA_VIDEO_STREAM_REQUIRED');
  if (expected.requireAudio && !probe.hasAudio) reasons.push('DIRECTOR_MEDIA_AUDIO_STREAM_REQUIRED');
  if (!Number.isFinite(probe.durationSeconds) || probe.durationSeconds <= 0) reasons.push('DIRECTOR_MEDIA_DURATION_INVALID');
  else if (Math.abs(probe.durationSeconds - expected.durationSeconds) > expected.maximumDurationDriftSeconds) {
    reasons.push('DIRECTOR_MEDIA_DURATION_DRIFT');
  }

  if (expected.requireVideo) {
    if (probe.width !== expected.width || probe.height !== expected.height) reasons.push('DIRECTOR_MEDIA_DIMENSION_MISMATCH');
    if (probe.fps === undefined || !Number.isFinite(probe.fps) || Math.abs(probe.fps - expected.fps) > 0.02) {
      reasons.push('DIRECTOR_MEDIA_FPS_MISMATCH');
    }
    if (
      expected.permittedVideoCodecs?.length &&
      (!probe.videoCodec || !expected.permittedVideoCodecs.includes(probe.videoCodec))
    ) reasons.push('DIRECTOR_MEDIA_VIDEO_CODEC_NOT_ADMITTED');
  }

  if (
    expected.requireAudio &&
    expected.permittedAudioCodecs?.length &&
    (!probe.audioCodec || !expected.permittedAudioCodecs.includes(probe.audioCodec))
  ) reasons.push('DIRECTOR_MEDIA_AUDIO_CODEC_NOT_ADMITTED');

  return Object.freeze({ admissible: reasons.length === 0, reasons: Object.freeze(reasons) });
}

export interface FfmpegFinalizationReceipt {
  id: string;
  inputAssetIds: readonly string[];
  outputAssetId: string;
  commandDigest: string;
  runtimeProfileDigest: string;
  ffmpegVersion: string;
  probeEvidenceId: string;
  createdAt: string;
}

/**
 * A finalization receipt proves which inputs, toolchain and command produced the
 * final artifact. It does not imply creative approval or publishing approval.
 */
export function validateFfmpegFinalizationReceipt(
  receipt: FfmpegFinalizationReceipt,
): readonly string[] {
  const reasons: string[] = [];
  if (!receipt.id.trim()) reasons.push('DIRECTOR_FFMPEG_RECEIPT_ID_REQUIRED');
  if (!receipt.inputAssetIds.length) reasons.push('DIRECTOR_FFMPEG_INPUTS_REQUIRED');
  if (!receipt.outputAssetId.trim()) reasons.push('DIRECTOR_FFMPEG_OUTPUT_REQUIRED');
  if (!receipt.commandDigest.trim() || !receipt.runtimeProfileDigest.trim()) reasons.push('DIRECTOR_FFMPEG_DIGEST_REQUIRED');
  if (!receipt.ffmpegVersion.trim() || !receipt.probeEvidenceId.trim()) reasons.push('DIRECTOR_FFMPEG_PROVENANCE_REQUIRED');
  return Object.freeze(reasons);
}
