import type {
  InstrumentFamily,
  InstrumentFingerprint,
  RestorationGainEvidence,
} from "../instrument-replacement.js";
import type {
  VocalPreservationMetrics,
  VocalRepairOperation,
} from "../vocal-restoration.js";

export type RestorationStemRole = "vocals" | "drums" | "bass" | "other" | "unknown";

export interface RestorationRuntimeSource {
  artifactId: string;
  uri: string;
  sha256: string;
  mimeType: string;
}

export interface RestorationProbeReceipt {
  sourceArtifactId: string;
  sourceSha256: string;
  codec: string;
  sampleRate: number;
  channels: number;
  sampleCount: number;
  durationSeconds: number;
  bitDepth?: number;
  lossless: boolean;
  runtimeReceiptId: string;
}

export interface RestorationStemReceipt {
  artifactId: string;
  parentArtifactId: string;
  role: RestorationStemRole;
  resultUri: string;
  sha256: string;
  sampleRate: number;
  channels: number;
  sampleCount: number;
  durationSeconds: number;
  modelId: string;
  modelVersion: string;
  confidence: number;
  bleedEstimate?: number;
  runtimeReceiptId: string;
}

export interface RestorationSeparationReceipt {
  jobId: string;
  sourceArtifactId: string;
  sourceSha256: string;
  modelId: string;
  modelVersion: string;
  stems: RestorationStemReceipt[];
  runtimeReceiptId: string;
}

export interface RestorationTransientObservation {
  sample: number;
  strength: number;
  confidence: number;
}

export interface RestorationSectionObservation {
  startSample: number;
  endSample: number;
  label?: string;
  confidence: number;
}

export interface RestorationVocalObservation {
  voicedFraction: number;
  medianF0Hz?: number;
  minimumF0Hz?: number;
  maximumF0Hz?: number;
  confidence: number;
}

export interface RestorationPerceptionReceipt {
  sourceArtifactId: string;
  sourceSha256: string;
  sampleRate: number;
  sampleCount: number;
  tempoBpm?: number;
  beatSamples: number[];
  downbeatSamples: number[];
  sections: RestorationSectionObservation[];
  transients: RestorationTransientObservation[];
  spectralCentroidHz?: number;
  rms?: number;
  role?: RestorationStemRole;
  vocal?: RestorationVocalObservation;
  confidences?: {
    tempo: number;
    beat: number;
    downbeat: number;
    section: number;
  };
  providerId: string;
  providerVersion: string;
  runtimeReceiptId: string;
}

export type RestorationRepairOperation =
  | "copy"
  | "gain"
  | "eq"
  | "declick"
  | "declip"
  | "denoise";

export interface RestorationRepairRequest {
  executionId: string;
  authorizationId: string;
  source: RestorationRuntimeSource;
  operation: RestorationRepairOperation;
  parameters: Record<string, string | number | boolean>;
  sampleRate: number;
  channels: number;
}

export interface RestorationRepairReceipt {
  executionId: string;
  sourceArtifactId: string;
  outputArtifactId: string;
  resultUri: string;
  outputSha256: string;
  sampleRate: number;
  channels: number;
  sampleCount: number;
  durationSeconds: number;
  operation: RestorationRepairOperation;
  runtimeReceiptId: string;
}

export interface RestorationReconstructionSegment {
  targetStartMs: number;
  targetEndMs: number;
  replacementStartMs: number;
  replacementEndMs: number;
  gainDb: number;
  sourceResidualMix: number;
  fadeMs: number;
  phaseInvert: boolean;
}

export interface RestorationReconstructionRequest {
  jobId: string;
  requestId: string;
  authorizationId: string;
  source: RestorationRuntimeSource;
  replacement: RestorationRuntimeSource;
  segments: RestorationReconstructionSegment[];
  sampleRate: number;
  channels: number;
}

export interface RestorationReconstructionReceipt {
  jobId: string;
  requestId: string;
  sourceArtifactId: string;
  replacementArtifactId: string;
  outputArtifactId: string;
  resultUri: string;
  outputSha256: string;
  sampleRate: number;
  channels: number;
  sampleCount: number;
  durationSeconds: number;
  segmentCount: number;
  runtimeReceiptId: string;
}

export interface RestorationInstrumentAssessmentSegment {
  sourceStartMs: number;
  sourceEndMs: number;
  replacementStartMs: number;
  replacementEndMs: number;
}

export interface RestorationInstrumentAssessmentRequest {
  assessmentId: string;
  source: RestorationRuntimeSource;
  replacement: RestorationRuntimeSource;
  instrumentFamily: InstrumentFamily;
  segments: RestorationInstrumentAssessmentSegment[];
}

export interface RestorationInstrumentAssessmentDiagnostics {
  sourceDamageScore: number;
  replacementDamageScore: number;
  sourceClippingRatio: number;
  replacementClippingRatio: number;
  sourceDropoutRatio: number;
  replacementDropoutRatio: number;
  sourceDurationMs: number;
  replacementDurationMs: number;
}

export interface RestorationInstrumentAssessmentReceipt {
  assessmentId: string;
  sourceArtifactId: string;
  replacementArtifactId: string;
  sourceSha256: string;
  replacementSha256: string;
  instrumentFamily: InstrumentFamily;
  observedFingerprint: InstrumentFingerprint;
  replacementFingerprint: InstrumentFingerprint;
  gainEvidence: RestorationGainEvidence;
  diagnostics: RestorationInstrumentAssessmentDiagnostics;
  runtimeReceiptId: string;
}

export interface RestorationVocalRepairSegment {
  startMs: number;
  endMs: number;
  operation: VocalRepairOperation;
  parameters: Record<string, string | number | boolean>;
  sourceResidualMix: number;
  fadeMs: number;
}

export interface RestorationVocalRepairRequest {
  jobId: string;
  requestId: string;
  authorizationId: string;
  source: RestorationRuntimeSource;
  segments: RestorationVocalRepairSegment[];
  sampleRate: number;
  channels: number;
}

export interface RestorationVocalRepairReceipt {
  jobId: string;
  requestId: string;
  sourceArtifactId: string;
  sourceSha256: string;
  outputArtifactId: string;
  resultUri: string;
  outputSha256: string;
  sampleRate: number;
  channels: number;
  sampleCount: number;
  durationSeconds: number;
  segmentCount: number;
  preservation: VocalPreservationMetrics;
  runtimeReceiptId: string;
}

export interface RestorationRuntimeClient {
  probe(source: RestorationRuntimeSource): Promise<RestorationProbeReceipt>;
  separate(input: {
    jobId: string;
    source: RestorationRuntimeSource;
    modelId?: string;
  }): Promise<RestorationSeparationReceipt>;
  perceive(input: {
    source: RestorationRuntimeSource;
    role?: RestorationStemRole;
  }): Promise<RestorationPerceptionReceipt>;
  execute(request: RestorationRepairRequest): Promise<RestorationRepairReceipt>;
  assessInstrumentReplacement?(
    request: RestorationInstrumentAssessmentRequest,
  ): Promise<RestorationInstrumentAssessmentReceipt>;
  reconstruct(request: RestorationReconstructionRequest): Promise<RestorationReconstructionReceipt>;
  restoreVocal(request: RestorationVocalRepairRequest): Promise<RestorationVocalRepairReceipt>;
  downloadArtifact(resultUri: string): Promise<Uint8Array>;
}

const HEX_64 = /^[a-f0-9]{64}$/i;

function assertRuntimeSource(source: RestorationRuntimeSource): void {
  if (!source.artifactId.trim()) throw new Error("Restoration runtime source artifact id is required.");
  if (!source.uri.trim()) throw new Error("Restoration runtime source URI is required.");
  if (!HEX_64.test(source.sha256)) throw new Error("Restoration runtime source SHA-256 is invalid.");
  if (!source.mimeType.startsWith("audio/")) throw new Error("Restoration runtime source must be audio.");
}

function finitePositive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be positive and finite.`);
  return value;
}

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) throw new Error("Music restoration runtime URL is required.");
  const url = new URL(trimmed);
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("Music restoration runtime requires HTTPS outside localhost.");
  }
  if (url.username || url.password) throw new Error("Music restoration runtime URL cannot contain credentials.");
  return trimmed;
}

async function jsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`Music restoration runtime failed (${response.status}): ${detail}`);
  }
  return response.json() as Promise<T>;
}

export class HttpRestorationRuntimeClient implements RestorationRuntimeClient {
  private readonly baseUrl: string;

  constructor(
    baseUrl: string,
    private readonly bearerToken: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    this.baseUrl = normalizeBaseUrl(baseUrl);
    if (!bearerToken.trim()) throw new Error("Music restoration runtime bearer token is required.");
  }

  async probe(source: RestorationRuntimeSource): Promise<RestorationProbeReceipt> {
    assertRuntimeSource(source);
    const receipt = await this.post<RestorationProbeReceipt>("/v1/probe", { source });
    if (receipt.sourceArtifactId !== source.artifactId || receipt.sourceSha256.toLowerCase() !== source.sha256.toLowerCase()) {
      throw new Error("Music restoration probe receipt is not bound to the requested source.");
    }
    finitePositive(receipt.sampleRate, "Probe sample rate");
    finitePositive(receipt.channels, "Probe channel count");
    if (!Number.isInteger(receipt.sampleCount) || receipt.sampleCount <= 0) throw new Error("Probe sample count is invalid.");
    return receipt;
  }

  async separate(input: {
    jobId: string;
    source: RestorationRuntimeSource;
    modelId?: string;
  }): Promise<RestorationSeparationReceipt> {
    assertRuntimeSource(input.source);
    if (!input.jobId.trim()) throw new Error("Separation job id is required.");
    const receipt = await this.post<RestorationSeparationReceipt>("/v1/separate", input);
    if (receipt.jobId !== input.jobId || receipt.sourceArtifactId !== input.source.artifactId) {
      throw new Error("Separation receipt identity mismatch.");
    }
    if (receipt.sourceSha256.toLowerCase() !== input.source.sha256.toLowerCase()) {
      throw new Error("Separation receipt source hash mismatch.");
    }
    if (!receipt.stems.length) throw new Error("Separation runtime returned no stems.");
    for (const stem of receipt.stems) {
      if (stem.parentArtifactId !== input.source.artifactId) throw new Error("Separated stem lineage mismatch.");
      if (!HEX_64.test(stem.sha256)) throw new Error("Separated stem hash is invalid.");
    }
    return receipt;
  }

  async perceive(input: {
    source: RestorationRuntimeSource;
    role?: RestorationStemRole;
  }): Promise<RestorationPerceptionReceipt> {
    assertRuntimeSource(input.source);
    const receipt = await this.post<RestorationPerceptionReceipt>("/v1/perceive", input);
    if (receipt.sourceArtifactId !== input.source.artifactId || receipt.sourceSha256.toLowerCase() !== input.source.sha256.toLowerCase()) {
      throw new Error("Perception receipt is not bound to the requested source.");
    }
    finitePositive(receipt.sampleRate, "Perception sample rate");
    if (!Number.isInteger(receipt.sampleCount) || receipt.sampleCount <= 0) throw new Error("Perception sample count is invalid.");
    return receipt;
  }

  async execute(request: RestorationRepairRequest): Promise<RestorationRepairReceipt> {
    assertRuntimeSource(request.source);
    if (!request.executionId.trim() || !request.authorizationId.trim()) {
      throw new Error("Restoration execution and authorization ids are required.");
    }
    const receipt = await this.post<RestorationRepairReceipt>("/v1/execute", request);
    if (receipt.executionId !== request.executionId || receipt.sourceArtifactId !== request.source.artifactId) {
      throw new Error("Restoration execution receipt identity mismatch.");
    }
    if (!HEX_64.test(receipt.outputSha256)) throw new Error("Restoration execution output hash is invalid.");
    return receipt;
  }

  async assessInstrumentReplacement(
    request: RestorationInstrumentAssessmentRequest,
  ): Promise<RestorationInstrumentAssessmentReceipt> {
    assertRuntimeSource(request.source);
    assertRuntimeSource(request.replacement);
    if (!request.assessmentId.trim()) throw new Error("Instrument assessment id is required.");
    if (request.source.artifactId === request.replacement.artifactId) {
      throw new Error("Instrument assessment source and replacement artifacts must differ.");
    }
    if (!request.segments.length) throw new Error("Instrument assessment requires at least one segment.");

    const receipt = await this.post<RestorationInstrumentAssessmentReceipt>(
      "/v1/reconstruction/assess",
      request,
    );
    if (receipt.assessmentId !== request.assessmentId) {
      throw new Error("Instrument assessment receipt identity mismatch.");
    }
    if (receipt.sourceArtifactId !== request.source.artifactId ||
        receipt.replacementArtifactId !== request.replacement.artifactId) {
      throw new Error("Instrument assessment receipt lineage mismatch.");
    }
    if (receipt.sourceSha256.toLowerCase() !== request.source.sha256.toLowerCase() ||
        receipt.replacementSha256.toLowerCase() !== request.replacement.sha256.toLowerCase()) {
      throw new Error("Instrument assessment receipt hash binding mismatch.");
    }
    if (receipt.instrumentFamily !== request.instrumentFamily) {
      throw new Error("Instrument assessment family mismatch.");
    }
    return receipt;
  }

  async reconstruct(request: RestorationReconstructionRequest): Promise<RestorationReconstructionReceipt> {
    assertRuntimeSource(request.source);
    assertRuntimeSource(request.replacement);
    if (!request.jobId.trim() || !request.requestId.trim() || !request.authorizationId.trim()) {
      throw new Error("Reconstruction job, request and authorization ids are required.");
    }
    if (request.source.artifactId === request.replacement.artifactId) {
      throw new Error("Reconstruction source and replacement artifacts must differ.");
    }
    if (!request.segments.length) throw new Error("Reconstruction requires at least one segment.");
    finitePositive(request.sampleRate, "Reconstruction sample rate");
    finitePositive(request.channels, "Reconstruction channel count");

    const receipt = await this.post<RestorationReconstructionReceipt>("/v1/reconstruct", request);
    if (receipt.jobId !== request.jobId || receipt.requestId !== request.requestId) {
      throw new Error("Reconstruction receipt identity mismatch.");
    }
    if (receipt.sourceArtifactId !== request.source.artifactId ||
        receipt.replacementArtifactId !== request.replacement.artifactId) {
      throw new Error("Reconstruction receipt lineage mismatch.");
    }
    if (!HEX_64.test(receipt.outputSha256)) throw new Error("Reconstruction output hash is invalid.");
    if (receipt.segmentCount !== request.segments.length) throw new Error("Reconstruction segment count mismatch.");
    return receipt;
  }

  async restoreVocal(request: RestorationVocalRepairRequest): Promise<RestorationVocalRepairReceipt> {
    assertRuntimeSource(request.source);
    if (!request.jobId.trim() || !request.requestId.trim() || !request.authorizationId.trim()) {
      throw new Error("Vocal restoration job, request and authorization ids are required.");
    }
    if (!request.segments.length) throw new Error("Vocal restoration requires at least one segment.");
    finitePositive(request.sampleRate, "Vocal restoration sample rate");
    finitePositive(request.channels, "Vocal restoration channel count");

    const receipt = await this.post<RestorationVocalRepairReceipt>("/v1/vocal/restore", request);
    if (receipt.jobId !== request.jobId || receipt.requestId !== request.requestId) {
      throw new Error("Vocal restoration receipt identity mismatch.");
    }
    if (receipt.sourceArtifactId !== request.source.artifactId ||
        receipt.sourceSha256.toLowerCase() !== request.source.sha256.toLowerCase()) {
      throw new Error("Vocal restoration receipt source binding mismatch.");
    }
    if (!HEX_64.test(receipt.outputSha256)) throw new Error("Vocal restoration output hash is invalid.");
    if (receipt.segmentCount !== request.segments.length) throw new Error("Vocal restoration segment count mismatch.");
    return receipt;
  }

  async downloadArtifact(resultUri: string): Promise<Uint8Array> {
    const url = resultUri.startsWith("http://") || resultUri.startsWith("https://")
      ? resultUri
      : `${this.baseUrl}${resultUri.startsWith("/") ? "" : "/"}${resultUri}`;
    if (!url.startsWith(this.baseUrl + "/")) throw new Error("Music restoration artifact URI escaped the admitted runtime.");
    const response = await this.fetcher(url, {
      headers: { Authorization: `Bearer ${this.bearerToken}` },
      redirect: "error",
    });
    if (!response.ok) throw new Error(`Music restoration artifact download failed (${response.status}).`);
    return new Uint8Array(await response.arrayBuffer());
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const response = await this.fetcher(this.baseUrl + path, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.bearerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      redirect: "error",
    });
    return jsonResponse<T>(response);
  }
}
