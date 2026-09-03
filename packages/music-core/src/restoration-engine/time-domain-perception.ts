import {
  type AudioAnalysisProvider,
  type RestorationAudioInput,
  validateRestorationAudioInput,
} from "./audio-input.js";
import type { EvidenceObservation } from "./evidence-engine.js";

export interface TimeDomainPerceptionConfig {
  shortWindowMs?: number;
  mediumWindowMs?: number;
  longWindowMs?: number;
  hopMs?: number;
}

const DEFAULTS = {
  shortWindowMs: 5,
  mediumWindowMs: 20,
  longWindowMs: 100,
  hopMs: 5,
};

const rms = (samples: Float32Array, start: number, end: number): number => {
  let sum = 0;
  for (let i = start; i < end; i += 1) sum += samples[i] * samples[i];
  return Math.sqrt(sum / Math.max(1, end - start));
};

const zeroCrossingRate = (samples: Float32Array, start: number, end: number): number => {
  let crossings = 0;
  for (let i = Math.max(start + 1, 1); i < end; i += 1) {
    const previous = samples[i - 1];
    const current = samples[i];
    if ((previous < 0 && current >= 0) || (previous >= 0 && current < 0)) crossings += 1;
  }
  return crossings / Math.max(1, end - start - 1);
};

const peak = (samples: Float32Array, start: number, end: number): number => {
  let value = 0;
  for (let i = start; i < end; i += 1) value = Math.max(value, Math.abs(samples[i]));
  return value;
};

const finite = (value: number): number => Number.isFinite(value) ? value : 0;

export class MultiResolutionTimeDomainProvider implements AudioAnalysisProvider {
  readonly id = "builtin.time-domain-perception";
  readonly version = "1.0.0";

  constructor(private readonly config: TimeDomainPerceptionConfig = {}) {}

  observe(input: RestorationAudioInput): EvidenceObservation[] {
    validateRestorationAudioInput(input);
    const shortMs = this.config.shortWindowMs ?? DEFAULTS.shortWindowMs;
    const mediumMs = this.config.mediumWindowMs ?? DEFAULTS.mediumWindowMs;
    const longMs = this.config.longWindowMs ?? DEFAULTS.longWindowMs;
    const hopMs = this.config.hopMs ?? DEFAULTS.hopMs;
    const start = input.startSample ?? 0;
    const end = start + (input.channels[0]?.length ?? 0);

    if (![shortMs, mediumMs, longMs, hopMs].every((v) => Number.isFinite(v) && v > 0)) {
      throw new Error("time-domain analysis windows must be positive finite values");
    }

    const observations: EvidenceObservation[] = [];
    const resolutions = [
      ["short", shortMs],
      ["medium", mediumMs],
      ["long", longMs],
    ] as const;

    for (const [resolution, windowMs] of resolutions) {
      const windowSamples = Math.max(1, Math.round((windowMs / 1000) * input.sampleRate));
      const hopSamples = Math.max(1, Math.round((hopMs / 1000) * input.sampleRate));
      const channelFeatures = input.channels.map((channel, channelIndex) => {
        const frames: Array<Record<string, number>> = [];
        for (let localStart = 0; localStart < channel.length; localStart += hopSamples) {
          const localEnd = Math.min(channel.length, localStart + windowSamples);
          if (localEnd <= localStart) break;
          frames.push({
            startSample: start + localStart,
            endSample: start + localEnd,
            rms: finite(rms(channel, localStart, localEnd)),
            peak: finite(peak(channel, localStart, localEnd)),
            zeroCrossingRate: finite(zeroCrossingRate(channel, localStart, localEnd)),
          });
        }
        return { channel: channelIndex, frames };
      });

      observations.push({
        id: `time-domain:${input.sourceArtifactId}:${resolution}:${start}:${end}`,
        kind: "audio.time-domain",
        confidence: 1,
        sourceArtifactId: input.sourceArtifactId,
        region: { startSample: start, endSample: end },
        data: {
          resolution,
          sampleRate: input.sampleRate,
          windowMs,
          hopMs,
          windowSamples,
          hopSamples,
          channelCount: input.channels.length,
          frameCount: channelFeatures[0]?.frames.length ?? 0,
          framesJson: JSON.stringify(channelFeatures),
        },
      });
    }

    return observations;
  }
}
