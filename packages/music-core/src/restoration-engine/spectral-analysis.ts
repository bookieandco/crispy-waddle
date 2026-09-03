import type { EvidenceObservation } from "./evidence-engine.js";
import type { RestorationAudioInput } from "./audio-input.js";

export type SpectralWindow = "hann" | "sine" | "none";

export interface SpectralAnalysisInput {
  readonly sampleRate: number;
  readonly channels: Float32Array[];
  readonly startSample: number;
  readonly fftSize: number;
  readonly hopSize: number;
  readonly window: SpectralWindow;
}

export interface SpectralObservationData {
  readonly channel: number;
  readonly frequencyBin: number;
  readonly frequencyHz: number;
  readonly magnitude: number;
  readonly phase: number;
  readonly windowStartSample: number;
  readonly windowEndSample: number;
  readonly fftSize: number;
  readonly hopSize: number;
  readonly windowFunction: SpectralWindow;
  readonly analysisVersion: string;
}

const TWO_PI = Math.PI * 2;
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

function windowValue(type: SpectralWindow, index: number, size: number): number {
  if (type === "none") return 1;
  if (size <= 1) return 1;
  if (type === "sine") return Math.sin((Math.PI * index) / (size - 1));
  return 0.5 * (1 - Math.cos((TWO_PI * index) / (size - 1)));
}

function isPowerOfTwo(value: number): boolean {
  return Number.isInteger(value) && value >= 2 && (value & (value - 1)) === 0;
}

/**
 * Dependency-free real-input DFT for deterministic analysis and tests.
 * Production deployments may replace this implementation behind the same
 * provider contract with FFTW/WASM/GPU acceleration.
 */
function analyzeFrame(
  samples: Float32Array,
  offset: number,
  input: SpectralAnalysisInput,
): Array<{ bin: number; magnitude: number; phase: number }> {
  const n = input.fftSize;
  const result: Array<{ bin: number; magnitude: number; phase: number }> = [];
  const bins = Math.floor(n / 2) + 1;

  for (let k = 0; k < bins; k += 1) {
    let real = 0;
    let imaginary = 0;
    for (let i = 0; i < n; i += 1) {
      const sample = offset + i < samples.length ? samples[offset + i] : 0;
      const weighted = sample * windowValue(input.window, i, n);
      const angle = (TWO_PI * k * i) / n;
      real += weighted * Math.cos(angle);
      imaginary -= weighted * Math.sin(angle);
    }

    const scale = 1 / n;
    real *= scale;
    imaginary *= scale;
    result.push({
      bin: k,
      magnitude: Math.sqrt(real * real + imaginary * imaginary),
      phase: Math.atan2(imaginary, real),
    });
  }

  return result;
}

export function analyzeSpectralInput(
  input: SpectralAnalysisInput,
  analysisVersion = "1.0.0",
): EvidenceObservation[] {
  if (!Number.isFinite(input.sampleRate) || input.sampleRate <= 0) {
    throw new Error("sampleRate must be positive");
  }
  if (!isPowerOfTwo(input.fftSize)) {
    throw new Error("fftSize must be a power of two >= 2");
  }
  if (!Number.isInteger(input.hopSize) || input.hopSize <= 0) {
    throw new Error("hopSize must be a positive integer");
  }
  if (input.startSample < 0 || !Number.isInteger(input.startSample)) {
    throw new Error("startSample must be a non-negative integer");
  }

  const observations: EvidenceObservation[] = [];
  input.channels.forEach((channel, channelIndex) => {
    for (let offset = 0; offset < channel.length; offset += input.hopSize) {
      const frameStart = input.startSample + offset;
      const frameEnd = frameStart + input.fftSize;
      const spectrum = analyzeFrame(channel, offset, input);
      for (const item of spectrum) {
        observations.push({
          id: `spectral:${channelIndex}:${frameStart}:${item.bin}:${input.fftSize}:${input.hopSize}:${input.window}`,
          kind: "audio.spectral",
          confidence: clamp01(Math.min(1, channel.length >= input.fftSize ? 1 : channel.length / input.fftSize)),
          sourceArtifactId: undefined,
          region: { startSample: frameStart, endSample: Math.min(frameEnd, input.startSample + channel.length) },
          data: {
            channel: channelIndex,
            frequencyBin: item.bin,
            frequencyHz: (item.bin * input.sampleRate) / input.fftSize,
            magnitude: item.magnitude,
            phase: item.phase,
            windowStartSample: frameStart,
            windowEndSample: frameEnd,
            fftSize: input.fftSize,
            hopSize: input.hopSize,
            windowFunction: input.window,
            analysisVersion,
          },
        });
      }
    }
  });

  return observations;
}

export class DeterministicSpectralAnalysisProvider {
  readonly id = "spectral.deterministic";
  readonly version = "1.0.0";

  constructor(
    private readonly fftSize = 256,
    private readonly hopSize = 128,
    private readonly window: SpectralWindow = "hann",
  ) {}

  observe(input: RestorationAudioInput): EvidenceObservation[] {
    return analyzeSpectralInput(
      {
        sampleRate: input.sampleRate,
        channels: input.channels,
        startSample: input.startSample ?? 0,
        fftSize: this.fftSize,
        hopSize: this.hopSize,
        window: this.window,
      },
      this.version,
    ).map((observation) => ({
      ...observation,
      sourceArtifactId: input.sourceArtifactId,
    }));
  }
}
