export type DirectorHumanMediaEngine =
  | 'musetalk'
  | 'liveportrait'
  | 'sadtalker'
  | 'coqui-tts';

export type DirectorHumanMediaTaskKind =
  | 'lip-sync'
  | 'portrait-animation'
  | 'talking-head'
  | 'voice-synthesis'
  | 'voice-clone'
  | 'voice-conversion';

export type DirectorHumanMediaAssetRole =
  | 'source-image'
  | 'source-video'
  | 'driving-video'
  | 'driving-audio'
  | 'source-audio'
  | 'target-voice'
  | 'product-reference'
  | 'output';

export interface DirectorHumanMediaAssetRef {
  assetId: string;
  role: DirectorHumanMediaAssetRole;
  mediaType: 'image' | 'video' | 'audio';
  uri?: string;
  sha256: string;
  rightsEvidenceIds: readonly string[];
}

export interface DirectorHumanMediaJobRequest {
  schema: 'director.human-media-job.v1';
  id: string;
  projectId: string;
  engine: DirectorHumanMediaEngine;
  task: DirectorHumanMediaTaskKind;
  inputAssets: readonly DirectorHumanMediaAssetRef[];
  text?: string;
  language?: string;
  voiceIdentityId?: string;
  parameters: Readonly<Record<string, unknown>>;
  evidenceIds: readonly string[];
  sensitiveData: boolean;
  allowCloudBurst: boolean;
  authority: 'DIRECTOR_HUMAN_MEDIA_JOB';
}

export interface DirectorHumanMediaModelArtifact {
  id: string;
  sha256: string;
  licenseEvidenceIds: readonly string[];
}

export interface DirectorHumanMediaRuntimeBundle {
  schema: 'director.human-media-runtime.v1';
  engine: DirectorHumanMediaEngine;
  runtimeVersion: string;
  sourceRepository: string;
  sourceRevision: string;
  image: string;
  imageDigest: string;
  modelArtifacts: readonly DirectorHumanMediaModelArtifact[];
  capabilities: readonly DirectorHumanMediaTaskKind[];
  minGpuVramGiB?: number;
  authority: 'DIRECTOR_HUMAN_MEDIA_RUNTIME_BUNDLE';
}

export interface DirectorHumanMediaGpuHealth {
  vendor: 'nvidia' | 'amd' | 'apple' | 'cpu';
  model?: string;
  count: number;
  vramGiBPerDevice?: number;
}

export interface DirectorHumanMediaHealthReceipt {
  schema: 'director.human-media-health.v1';
  runtimeInstanceId: string;
  engine: DirectorHumanMediaEngine;
  productionReady: boolean;
  imageDigest: string;
  sourceRevision: string;
  modelArtifactSha256s: readonly string[];
  gpu: DirectorHumanMediaGpuHealth;
  licenseEvidenceIds: readonly string[];
  observedAt: string;
  reasons: readonly string[];
  authority: 'DIRECTOR_HUMAN_MEDIA_HEALTH';
}

export interface DirectorHumanMediaOutputRef {
  uri: string;
  mediaType: 'video' | 'audio';
  sha256: string;
}

export interface DirectorHumanMediaExecutionReceipt {
  schema: 'director.human-media-execution.v1';
  jobId: string;
  providerJobId: string;
  engine: DirectorHumanMediaEngine;
  task: DirectorHumanMediaTaskKind;
  status: 'queued' | 'processing' | 'ready' | 'failed' | 'cancelled';
  runtimeInstanceId: string;
  imageDigest: string;
  sourceRevision: string;
  modelArtifactSha256s: readonly string[];
  startedAt?: string;
  completedAt?: string;
  output?: DirectorHumanMediaOutputRef;
  errorCode?: string;
  qualityClaim: false;
  authority: 'DIRECTOR_HUMAN_MEDIA_EXECUTION_RECEIPT';
}

export interface DirectorHumanMediaRuntimeParityDecision {
  compatible: boolean;
  reasons: readonly string[];
}

const SHA256_RE = /^(?:sha256:)?[a-f0-9]{64}$/i;

function nonEmpty(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function validSha256(value: string): boolean {
  return SHA256_RE.test(value.trim());
}

function uniqueNonEmpty(values: readonly string[]): boolean {
  const normalized = values.map((value) => value.trim());
  return normalized.every(Boolean) && new Set(normalized).size === normalized.length;
}

function assetRoles(request: DirectorHumanMediaJobRequest): Set<DirectorHumanMediaAssetRole> {
  return new Set(request.inputAssets.map((asset) => asset.role));
}

export function validateDirectorHumanMediaJob(
  request: DirectorHumanMediaJobRequest,
): readonly string[] {
  const reasons: string[] = [];
  if (!request.id.trim() || !request.projectId.trim()) {
    reasons.push('DIRECTOR_HUMAN_MEDIA_JOB_IDENTITY_REQUIRED');
  }
  if (!request.evidenceIds.length || !uniqueNonEmpty(request.evidenceIds)) {
    reasons.push('DIRECTOR_HUMAN_MEDIA_JOB_EVIDENCE_REQUIRED');
  }
  if (!request.inputAssets.length && request.task !== 'voice-synthesis') {
    reasons.push('DIRECTOR_HUMAN_MEDIA_INPUT_REQUIRED');
  }

  const ids = new Set<string>();
  for (const asset of request.inputAssets) {
    if (!asset.assetId.trim() || ids.has(asset.assetId)) {
      reasons.push('DIRECTOR_HUMAN_MEDIA_ASSET_ID_INVALID');
    }
    ids.add(asset.assetId);
    if (!validSha256(asset.sha256)) reasons.push(`DIRECTOR_HUMAN_MEDIA_ASSET_SHA_INVALID:${asset.assetId}`);
    if (!asset.rightsEvidenceIds.length || !uniqueNonEmpty(asset.rightsEvidenceIds)) {
      reasons.push(`DIRECTOR_HUMAN_MEDIA_ASSET_RIGHTS_REQUIRED:${asset.assetId}`);
    }
  }

  const roles = assetRoles(request);
  switch (request.task) {
    case 'lip-sync':
      if (!(roles.has('source-video') || roles.has('source-image'))) {
        reasons.push('DIRECTOR_HUMAN_MEDIA_LIPSYNC_VISUAL_REQUIRED');
      }
      if (!(roles.has('driving-audio') || roles.has('source-audio'))) {
        reasons.push('DIRECTOR_HUMAN_MEDIA_LIPSYNC_AUDIO_REQUIRED');
      }
      break;
    case 'portrait-animation':
      if (!(roles.has('source-image') || roles.has('source-video'))) {
        reasons.push('DIRECTOR_HUMAN_MEDIA_PORTRAIT_SOURCE_REQUIRED');
      }
      if (!roles.has('driving-video')) {
        reasons.push('DIRECTOR_HUMAN_MEDIA_PORTRAIT_DRIVER_REQUIRED');
      }
      break;
    case 'talking-head':
      if (!roles.has('source-image')) reasons.push('DIRECTOR_HUMAN_MEDIA_TALKING_HEAD_IMAGE_REQUIRED');
      if (!(roles.has('driving-audio') || roles.has('source-audio'))) {
        reasons.push('DIRECTOR_HUMAN_MEDIA_TALKING_HEAD_AUDIO_REQUIRED');
      }
      break;
    case 'voice-synthesis':
      if (!nonEmpty(request.text)) reasons.push('DIRECTOR_HUMAN_MEDIA_VOICE_TEXT_REQUIRED');
      break;
    case 'voice-clone':
      if (!nonEmpty(request.text)) reasons.push('DIRECTOR_HUMAN_MEDIA_VOICE_TEXT_REQUIRED');
      if (!roles.has('target-voice')) reasons.push('DIRECTOR_HUMAN_MEDIA_TARGET_VOICE_REQUIRED');
      if (!nonEmpty(request.voiceIdentityId)) reasons.push('DIRECTOR_HUMAN_MEDIA_VOICE_IDENTITY_REQUIRED');
      break;
    case 'voice-conversion':
      if (!roles.has('source-audio')) reasons.push('DIRECTOR_HUMAN_MEDIA_SOURCE_AUDIO_REQUIRED');
      if (!roles.has('target-voice')) reasons.push('DIRECTOR_HUMAN_MEDIA_TARGET_VOICE_REQUIRED');
      if (!nonEmpty(request.voiceIdentityId)) reasons.push('DIRECTOR_HUMAN_MEDIA_VOICE_IDENTITY_REQUIRED');
      break;
  }

  const engineSupportsTask: Readonly<Record<DirectorHumanMediaEngine, readonly DirectorHumanMediaTaskKind[]>> = {
    musetalk: ['lip-sync'],
    liveportrait: ['portrait-animation'],
    sadtalker: ['talking-head'],
    'coqui-tts': ['voice-synthesis', 'voice-clone', 'voice-conversion'],
  };
  if (!engineSupportsTask[request.engine].includes(request.task)) {
    reasons.push(`DIRECTOR_HUMAN_MEDIA_ENGINE_TASK_MISMATCH:${request.engine}:${request.task}`);
  }

  if (request.sensitiveData && request.allowCloudBurst) {
    reasons.push('DIRECTOR_HUMAN_MEDIA_SENSITIVE_CLOUD_BURST_FORBIDDEN');
  }

  return Object.freeze([...new Set(reasons)]);
}

export function validateDirectorHumanMediaRuntimeBundle(
  bundle: DirectorHumanMediaRuntimeBundle,
): readonly string[] {
  const reasons: string[] = [];
  if (
    !bundle.runtimeVersion.trim() ||
    !bundle.sourceRepository.trim() ||
    !bundle.sourceRevision.trim() ||
    !bundle.image.trim()
  ) reasons.push('DIRECTOR_HUMAN_MEDIA_RUNTIME_IDENTITY_REQUIRED');
  if (!validSha256(bundle.imageDigest)) reasons.push('DIRECTOR_HUMAN_MEDIA_RUNTIME_IMAGE_DIGEST_REQUIRED');
  if (!bundle.capabilities.length) reasons.push('DIRECTOR_HUMAN_MEDIA_RUNTIME_CAPABILITY_REQUIRED');
  if (!bundle.modelArtifacts.length) reasons.push('DIRECTOR_HUMAN_MEDIA_MODEL_ARTIFACT_REQUIRED');
  if (
    bundle.minGpuVramGiB !== undefined &&
    (!Number.isFinite(bundle.minGpuVramGiB) || bundle.minGpuVramGiB <= 0)
  ) reasons.push('DIRECTOR_HUMAN_MEDIA_RUNTIME_GPU_VRAM_INVALID');

  const artifactIds = new Set<string>();
  for (const artifact of bundle.modelArtifacts) {
    if (!artifact.id.trim() || artifactIds.has(artifact.id)) {
      reasons.push('DIRECTOR_HUMAN_MEDIA_MODEL_ARTIFACT_ID_INVALID');
    }
    artifactIds.add(artifact.id);
    if (!validSha256(artifact.sha256)) {
      reasons.push(`DIRECTOR_HUMAN_MEDIA_MODEL_ARTIFACT_SHA_INVALID:${artifact.id}`);
    }
    if (!artifact.licenseEvidenceIds.length || !uniqueNonEmpty(artifact.licenseEvidenceIds)) {
      reasons.push(`DIRECTOR_HUMAN_MEDIA_MODEL_LICENSE_EVIDENCE_REQUIRED:${artifact.id}`);
    }
  }
  return Object.freeze([...new Set(reasons)]);
}

export function evaluateDirectorHumanMediaHealth(
  bundle: DirectorHumanMediaRuntimeBundle,
  receipt: DirectorHumanMediaHealthReceipt,
): readonly string[] {
  const reasons: string[] = [...validateDirectorHumanMediaRuntimeBundle(bundle)];
  if (!receipt.runtimeInstanceId.trim()) reasons.push('DIRECTOR_HUMAN_MEDIA_RUNTIME_INSTANCE_REQUIRED');
  if (!Number.isFinite(Date.parse(receipt.observedAt))) reasons.push('DIRECTOR_HUMAN_MEDIA_HEALTH_TIME_INVALID');
  if (receipt.engine !== bundle.engine) reasons.push('DIRECTOR_HUMAN_MEDIA_HEALTH_ENGINE_MISMATCH');
  if (receipt.imageDigest !== bundle.imageDigest) reasons.push('DIRECTOR_HUMAN_MEDIA_HEALTH_IMAGE_MISMATCH');
  if (receipt.sourceRevision !== bundle.sourceRevision) reasons.push('DIRECTOR_HUMAN_MEDIA_HEALTH_SOURCE_MISMATCH');

  const expectedArtifacts = [...bundle.modelArtifacts.map((artifact) => artifact.sha256)].sort();
  const actualArtifacts = [...receipt.modelArtifactSha256s].sort();
  if (
    expectedArtifacts.length !== actualArtifacts.length ||
    expectedArtifacts.some((value, index) => value !== actualArtifacts[index])
  ) reasons.push('DIRECTOR_HUMAN_MEDIA_HEALTH_MODEL_BUNDLE_MISMATCH');

  if (!receipt.licenseEvidenceIds.length || !uniqueNonEmpty(receipt.licenseEvidenceIds)) {
    reasons.push('DIRECTOR_HUMAN_MEDIA_HEALTH_LICENSE_EVIDENCE_REQUIRED');
  } else {
    const requiredLicenseEvidence = new Set(
      bundle.modelArtifacts.flatMap((artifact) => artifact.licenseEvidenceIds),
    );
    const observedLicenseEvidence = new Set(receipt.licenseEvidenceIds);
    if ([...requiredLicenseEvidence].some((id) => !observedLicenseEvidence.has(id))) {
      reasons.push('DIRECTOR_HUMAN_MEDIA_HEALTH_MODEL_LICENSE_EVIDENCE_MISMATCH');
    }
  }
  if (bundle.minGpuVramGiB !== undefined) {
    if (
      receipt.gpu.vendor === 'cpu' ||
      receipt.gpu.count < 1 ||
      (receipt.gpu.vramGiBPerDevice ?? 0) < bundle.minGpuVramGiB
    ) reasons.push('DIRECTOR_HUMAN_MEDIA_HEALTH_GPU_INSUFFICIENT');
  }
  if (receipt.productionReady !== true) reasons.push('DIRECTOR_HUMAN_MEDIA_NOT_PRODUCTION_READY');
  if (receipt.productionReady === true && receipt.reasons.length) {
    reasons.push('DIRECTOR_HUMAN_MEDIA_READY_WITH_BLOCKING_REASONS');
  }
  return Object.freeze([...new Set(reasons)]);
}

export function evaluateDirectorHumanMediaRuntimeParity(
  homebase: DirectorHumanMediaRuntimeBundle,
  burst: DirectorHumanMediaRuntimeBundle,
): DirectorHumanMediaRuntimeParityDecision {
  const reasons: string[] = [];
  if (homebase.engine !== burst.engine) reasons.push('DIRECTOR_HUMAN_MEDIA_PARITY_ENGINE_MISMATCH');
  if (homebase.imageDigest !== burst.imageDigest) reasons.push('DIRECTOR_HUMAN_MEDIA_PARITY_IMAGE_MISMATCH');
  if (homebase.sourceRevision !== burst.sourceRevision) reasons.push('DIRECTOR_HUMAN_MEDIA_PARITY_SOURCE_MISMATCH');
  if (homebase.runtimeVersion !== burst.runtimeVersion) reasons.push('DIRECTOR_HUMAN_MEDIA_PARITY_RUNTIME_VERSION_MISMATCH');

  const homeArtifacts = [...homebase.modelArtifacts.map((artifact) => artifact.sha256)].sort();
  const burstArtifacts = [...burst.modelArtifacts.map((artifact) => artifact.sha256)].sort();
  if (
    homeArtifacts.length !== burstArtifacts.length ||
    homeArtifacts.some((value, index) => value !== burstArtifacts[index])
  ) reasons.push('DIRECTOR_HUMAN_MEDIA_PARITY_MODEL_BUNDLE_MISMATCH');

  return Object.freeze({
    compatible: reasons.length === 0,
    reasons: Object.freeze([...new Set(reasons)]),
  });
}

export function validateDirectorHumanMediaExecutionReceipt(
  request: DirectorHumanMediaJobRequest,
  bundle: DirectorHumanMediaRuntimeBundle,
  receipt: DirectorHumanMediaExecutionReceipt,
): readonly string[] {
  const reasons: string[] = [];
  if (receipt.jobId !== request.id) reasons.push('DIRECTOR_HUMAN_MEDIA_RECEIPT_JOB_MISMATCH');
  if (receipt.engine !== request.engine || receipt.engine !== bundle.engine) {
    reasons.push('DIRECTOR_HUMAN_MEDIA_RECEIPT_ENGINE_MISMATCH');
  }
  if (receipt.task !== request.task) reasons.push('DIRECTOR_HUMAN_MEDIA_RECEIPT_TASK_MISMATCH');
  if (!receipt.providerJobId.trim() || !receipt.runtimeInstanceId.trim()) {
    reasons.push('DIRECTOR_HUMAN_MEDIA_RECEIPT_IDENTITY_REQUIRED');
  }
  if (receipt.imageDigest !== bundle.imageDigest) reasons.push('DIRECTOR_HUMAN_MEDIA_RECEIPT_IMAGE_MISMATCH');
  if (receipt.sourceRevision !== bundle.sourceRevision) reasons.push('DIRECTOR_HUMAN_MEDIA_RECEIPT_SOURCE_MISMATCH');

  const expectedArtifacts = [...bundle.modelArtifacts.map((artifact) => artifact.sha256)].sort();
  const actualArtifacts = [...receipt.modelArtifactSha256s].sort();
  if (
    expectedArtifacts.length !== actualArtifacts.length ||
    expectedArtifacts.some((value, index) => value !== actualArtifacts[index])
  ) reasons.push('DIRECTOR_HUMAN_MEDIA_RECEIPT_MODEL_BUNDLE_MISMATCH');

  if (receipt.qualityClaim !== false) reasons.push('DIRECTOR_HUMAN_MEDIA_RUNTIME_QUALITY_CLAIM_FORBIDDEN');
  if (receipt.status === 'ready') {
    if (!receipt.output?.uri.trim() || !validSha256(receipt.output?.sha256 ?? '')) {
      reasons.push('DIRECTOR_HUMAN_MEDIA_RECEIPT_OUTPUT_REQUIRED');
    }
    if (!receipt.completedAt || !Number.isFinite(Date.parse(receipt.completedAt))) {
      reasons.push('DIRECTOR_HUMAN_MEDIA_RECEIPT_COMPLETION_TIME_REQUIRED');
    }
  }
  return Object.freeze([...new Set(reasons)]);
}
