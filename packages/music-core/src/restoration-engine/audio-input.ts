export interface RestorationAudioInput {
  /** Stable identifier for the immutable source artifact. */
  sourceArtifactId: string;
  /** Original/declared sample rate. Analysis must not resample implicitly. */
  sampleRate: number;
  /** Channel-major PCM. Every channel must contain the same number of samples. */
  channels: Float32Array[];
  /** Source bit depth when known. */
  bitDepth?: number;
  /** Explicit source channel layout when known. */
  channelLayout?: string;
  /** Absolute sample origin of this buffer in the source artifact. */
  startSample?: number;
  /** Immutable source hash when available. */
  sourceHash?: string;
}

export interface AudioAnalysisProvider {
  readonly id: string;
  readonly version: string;
  observe(input: RestorationAudioInput): import("./evidence-engine.js").EvidenceObservation[];
}

export function validateRestorationAudioInput(input: RestorationAudioInput): void {
  if (!input.sourceArtifactId) throw new Error("sourceArtifactId is required");
  if (!Number.isFinite(input.sampleRate) || input.sampleRate <= 0) {
    throw new Error("sampleRate must be a positive finite number");
  }
  if (!Array.isArray(input.channels) || input.channels.length === 0) {
    throw new Error("at least one audio channel is required");
  }

  const sampleCount = input.channels[0]?.length ?? 0;
  for (const channel of input.channels) {
    if (channel.length !== sampleCount) {
      throw new Error("all audio channels must have equal sample counts");
    }
    for (const sample of channel) {
      if (!Number.isFinite(sample)) throw new Error("audio samples must be finite");
    }
  }

  if (input.startSample !== undefined &&
      (!Number.isInteger(input.startSample) || input.startSample < 0)) {
    throw new Error("startSample must be a non-negative integer");
  }

  if (input.bitDepth !== undefined &&
      (!Number.isInteger(input.bitDepth) || input.bitDepth <= 0)) {
    throw new Error("bitDepth must be a positive integer when provided");
  }
}
