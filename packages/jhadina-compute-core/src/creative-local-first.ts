/**
 * Source-only free-first admission for the EXISTING Director/Compute/Pupson/POD
 * executors. This module never downloads weights, starts a GPU, calls providers,
 * creates a bill, publishes a design, or submits a Printify order.
 */
export type CreativeConsumer = 'jllm' | 'director' | 'pupsonstuff' | 'pod';
export type CreativeOperation =
  | 'text-to-image' | 'image-to-image' | 'image-upscale'
  | 'text-to-video' | 'image-to-video' | 'video-to-video'
  | 'video-montage';

export type CreativeLocalBackend = {
  id: string;
  engine: 'comfyui' | 'automatic1111' | 'openmontage';
  capabilities: readonly CreativeOperation[];
  /** Deployment-derived receipts, NOT public-client options or a registry listing. */
  runtimeHealthy: boolean;
  approvedCheckpointSha256: string | null;
  commercialModelRightsVerified: boolean;
  workflowRightsVerified: boolean;
  localOwnedCompute: boolean;
  privateEndpointVerified: boolean;
  hasPaidExternalCalls: boolean;
  /** Explicit admission, not a claim of free electricity or hardware. */
  zeroMeteredProviderFeeVerified: boolean;
};

export type CreativeLocalRequest = {
  requestId: string;
  ownerId: string;
  projectId: string;
  idempotencyKey: string;
  consumer: CreativeConsumer;
  operation: CreativeOperation;
  sourceAssetIds: readonly string[];
  includesCustomerMedia: boolean;
  customerConsentGranted: boolean;
  commercialUse: boolean;
  ownerAuthorized: boolean;
};

export type CreativeLocalPlan =
  | { status: 'blocked'; reasons: string[]; computeProfileId: string }
  | { status: 'eligible'; backendId: string; computeProfileId: string; authority: {
      requestId: string; ownerId: string; projectId: string; idempotencyKey: string; consumer: CreativeConsumer;
    }; limitations: readonly string[] };

const VIDEO_OPS: readonly CreativeOperation[] = ['text-to-video', 'image-to-video', 'video-to-video', 'video-montage'];
const REFERENCE_OPS: readonly CreativeOperation[] = ['image-to-image', 'image-upscale', 'image-to-video', 'video-to-video'];
const BACKEND_PREFERENCE: Record<CreativeOperation, readonly CreativeLocalBackend['engine'][]> = {
  'text-to-image': ['comfyui', 'automatic1111', 'openmontage'],
  'image-to-image': ['comfyui', 'automatic1111', 'openmontage'],
  'image-upscale': ['comfyui', 'automatic1111', 'openmontage'],
  'text-to-video': ['comfyui', 'openmontage', 'automatic1111'],
  'image-to-video': ['comfyui', 'openmontage', 'automatic1111'],
  'video-to-video': ['comfyui', 'openmontage', 'automatic1111'],
  'video-montage': ['openmontage', 'comfyui', 'automatic1111'],
};

export const FREE_CREATIVE_UPSTREAMS = Object.freeze([
  { id: 'comfyui', repository: 'Comfy-Org/ComfyUI', codeLicense: 'GPL-3.0', role: 'primary image/image-edit and diffusion-video workflow backend' },
  { id: 'automatic1111', repository: 'AUTOMATIC1111/stable-diffusion-webui', codeLicense: 'AGPL-3.0', role: 'optional still-image fallback; separate server process' },
  { id: 'unsloth', repository: 'unslothai/unsloth', codeLicense: 'Apache-2.0', role: 'checkpoint/LoRA training and optimization, not a second media job authority' },
  { id: 'openmontage', repository: 'calesthio/OpenMontage', codeLicense: 'AGPL-3.0', role: 'Director-owned footage editing, storyboards, montage and final composition' },
] as const);

export function computeProfileForCreative(
  consumer: CreativeConsumer,
  operation: CreativeOperation,
): string {
  const isVideo = VIDEO_OPS.includes(operation);
  if (consumer === 'pupsonstuff') {
    if (isVideo) throw new Error('PUPSON_VIDEO_REQUIRES_DIRECTOR_AUTHORITY');
    return 'pupson.image.default';
  }
  if (consumer === 'pod') {
    if (isVideo) throw new Error('POD_VIDEO_REQUIRES_DIRECTOR_AUTHORITY');
    return 'pod.image.default';
  }
  // JLLM requests a Director creative job; JLLM never becomes the media executor.
  return isVideo ? 'director.video.default' : 'director.image.default';
}

function ready(candidate: CreativeLocalBackend, commercialUse: boolean): boolean {
  return Boolean(
    candidate.id.trim() &&
    candidate.runtimeHealthy &&
    candidate.approvedCheckpointSha256 &&
    /^[a-f0-9]{64}$/i.test(candidate.approvedCheckpointSha256) &&
    candidate.workflowRightsVerified &&
    (!commercialUse || candidate.commercialModelRightsVerified) &&
    candidate.localOwnedCompute &&
    candidate.privateEndpointVerified &&
    !candidate.hasPaidExternalCalls &&
    candidate.zeroMeteredProviderFeeVerified
  );
}

/** Return an inert admission PLAN; the owning domain still authorizes execution. */
export function planFreeFirstCreative(
  request: CreativeLocalRequest,
  backends: readonly CreativeLocalBackend[],
): CreativeLocalPlan {
  const computeProfileId = computeProfileForCreative(request.consumer, request.operation);
  const reasons: string[] = [];
  if (!request.ownerAuthorized || !request.ownerId.trim() || !request.projectId.trim()) {
    reasons.push('OWNER_PROJECT_AUTHORIZATION_REQUIRED');
  }
  if (!request.requestId.trim() || !request.idempotencyKey.trim()) {
    reasons.push('DURABLE_JOB_IDEMPOTENCY_REQUIRED');
  }
  if (REFERENCE_OPS.includes(request.operation) && request.sourceAssetIds.length === 0) {
    reasons.push('REFERENCE_MEDIA_REQUIRED');
  }
  if (request.includesCustomerMedia && !request.customerConsentGranted) {
    reasons.push('CUSTOMER_MEDIA_CONSENT_REQUIRED');
  }
  if (reasons.length) return { status: 'blocked', reasons, computeProfileId };

  const candidates = backends
    .filter((backend) => backend.capabilities.includes(request.operation))
    .sort((a,b) => BACKEND_PREFERENCE[request.operation].indexOf(a.engine) -
      BACKEND_PREFERENCE[request.operation].indexOf(b.engine));
  const selected = candidates.find((candidate) => ready(candidate, request.commercialUse));
  if (!selected) {
    return { status: 'blocked', reasons: [
      'NO_CERTIFIED_PRIVATE_OWNED_LOCAL_BACKEND_WITH_ZERO_METERED_PROVIDER_FEES',
    ], computeProfileId };
  }
  return {
    status: 'eligible',
    backendId: selected.id,
    computeProfileId,
    authority: {
      requestId: request.requestId,
      ownerId: request.ownerId,
      projectId: request.projectId,
      idempotencyKey: request.idempotencyKey,
      consumer: request.consumer,
    },
    limitations: [
      'No hardware, electricity, storage, or maintenance cost waiver is implied.',
      'No deployment, GPU start, provider call, training, print order, spending, or publishing is authorized.',
      'Domain approval, immutable execution receipt, and output QC remain mandatory.',
    ],
  };
}
