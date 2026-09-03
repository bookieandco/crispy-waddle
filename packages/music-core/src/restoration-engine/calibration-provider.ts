import type { EvidenceObservation } from "./evidence-engine.js";
import {
  type RestorationAudioInput,
  validateRestorationAudioInput,
} from "./audio-input.js";

export interface CalibrationObservationData {
  sampleRate: number;
  channelCount: number;
  sampleCount: number;
  durationSamples: number;
  peak: number;
  rms: number;
  crestFactor: number | null;
  dcOffset: number;
  clippingIndicators: number;
  channelLayout: string | null;
  sourceHash: string | null;
}

const meanSquare = (samples: Float32Array): number => {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  return sum / samples.length;
};

const mean = (samples: Float32Array): number => {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (const sample of samples) sum += sample;
  return sum / samples.length;
};

const peak = (samples: Float32Array): number => {
  let value = 0;
  for (const sample of samples) value = Math.max(value, Math.abs(sample));
  return value;
};

const clippingIndicators = (samples: Float32Array): number => {
  let count = 0;
  for (const sample of samples) {
    if (Math.abs(sample) >= 1) count += 1;
  }
  return count;
};

export function calibrateAudioInput(input: RestorationAudioInput): CalibrationObservationData[] {
  validateRestorationAudioInput(input);

  const sampleCount = input.channels[0]?.length ?? 0;
  return input.channels.map((channel, channelIndex) => {
    const rms = Math.sqrt(meanSquare(channel));
    return {
      sampleRate: input.sampleRate,
      channelCount: input.channels.length,
      sampleCount,
      durationSamples: sampleCount,
      peak: peak(channel),
      rms,
      crestFactor: rms > 0 ? peak(channel) / rms : null,
      dcOffset: mean(channel),
      clippingIndicators: clippingIndicators(channel),
      channelLayout: input.channelLayout ?? null,
      sourceHash: input.sourceHash ?? null,
    };
  });
}

export class DeterministicCalibrationProvider {
  readonly id = "calibration.deterministic";
  readonly version = "1.0.0";

  observe(input: RestorationAudioInput): EvidenceObservation[] {
    const results = calibrateAudioInput(input);
    return results.map((data, channelIndex) => ({
      id: `${this.id}:${input.sourceArtifactId}:channel:${channelIndex}`,
      kind: "audio.calibration",
      confidence: 1,
      sourceArtifactId: input.sourceArtifactId,
      data: {
        ...data,
        channel: channelIndex,
        startSample: input.startSample ?? 0,
        endSample: (input.startSample ?? 0) + data.sampleCount,
      },
    }));
  }
}
