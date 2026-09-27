export type ComputeWorkloadKind =
  | 'llm-interactive'
  | 'character-runtime'
  | 'image-generation'
  | 'video-generation'
  | 'audio-generation'
  | 'foley-generation'
  | 'voice-generation'
  | 'render'
  | 'transcode'
  | 'three-d'
  | 'training'
  | 'memory-index'
  | 'embedding'
  | 'batch-analysis';

export type ComputeQueueClass =
  | 'interactive'
  | 'creative'
  | 'render'
  | 'background'
  | 'maintenance';

export type ComputeProvider = 'homebase' | 'remote-homebase' | 'cloud';
export type AcceleratorVendor = 'nvidia' | 'amd' | 'apple' | 'cpu';

export type AcceleratorInventory = {
  vendor: AcceleratorVendor;
  model?: string;
  count: number;
  vramGiBPerDevice?: number;
  features?: string[];
};

export type GpuResourceRequest = {
  vendor?: Exclude<AcceleratorVendor, 'cpu'>;
  count: number;
  minVramGiBPerDevice?: number;
  requiredFeatures?: string[];
};

export type ComputeResourceRequest = {
  cpuCores: number;
  ramGiB: number;
  scratchGiB: number;
  gpu?: GpuResourceRequest;
  networkMbps?: number;
  durableReadGiB?: number;
  durableWriteGiB?: number;
  /**
   * Cloud is never inferred from resource pressure. The caller must explicitly
   * authorize burst eligibility and the policy layer must still approve it.
   */
  allowCloudBurst?: boolean;
  /**
   * Marks workloads whose inputs include private memories, unreleased source
   * media, voice/identity material, credentials or other data that should not
   * leave the trusted local/remote-Homebase boundary by default.
   */
  sensitiveData?: boolean;
  maxCostUsdPerHour?: number;
};

export type ComputeAuthorityBinding = {
  /**
   * Names the durable subsystem record that owns the job. Compute never
   * becomes the authority merely because it executes the work.
   */
  system: string;
  jobId: string;
  idempotencyKey: string;
  projectId?: string;
};

export type ComputeWorkload = {
  id: string;
  source:
    | 'jllm'
    | 'director'
    | 'social'
    | 'growth'
    | 'pupsonstuff'
    | 'pod'
    | 'music'
    | 'memory'
    | 'homebase'
    | 'other';
  kind: ComputeWorkloadKind;
  queue: ComputeQueueClass;
  priority: number;
  authority: ComputeAuthorityBinding;
  /**
   * Deployment-owned sizing profile used to resolve this workload. This
   * remains on the resolved workload for receipts/observability.
   */
  resourceProfileId: string;
  resources: ComputeResourceRequest;
  dataLocalityKeys?: string[];
  preferredNodeIds?: string[];
  forbiddenNodeIds?: string[];
  createdAt: string;
};

export type ComputeNode = {
  id: string;
  provider: ComputeProvider;
  zone: string;
  status: 'ready' | 'draining' | 'offline';
  cpuCoresFree: number;
  ramGiBFree: number;
  scratchGiBFree: number;
  networkMbpsAvailable?: number;
  accelerators: AcceleratorInventory[];
  localityKeys?: string[];
  hourlyCostUsd?: number;
  labels?: Record<string, string>;
};

export type PlacementRejectionCode =
  | 'NODE_NOT_READY'
  | 'FORBIDDEN_NODE'
  | 'CPU_INSUFFICIENT'
  | 'RAM_INSUFFICIENT'
  | 'SCRATCH_INSUFFICIENT'
  | 'NETWORK_INSUFFICIENT'
  | 'GPU_INSUFFICIENT'
  | 'GPU_VRAM_INSUFFICIENT'
  | 'GPU_FEATURE_MISSING'
  | 'CLOUD_BURST_NOT_ALLOWED'
  | 'SENSITIVE_DATA_CLOUD_DENIED'
  | 'COST_LIMIT_EXCEEDED';

export type PlacementRejection = {
  nodeId: string;
  codes: PlacementRejectionCode[];
};

export type PlacementCandidate = {
  nodeId: string;
  score: number;
  reasons: string[];
};

export type PlacementPlan = {
  workloadId: string;
  selectedNodeId?: string;
  candidates: PlacementCandidate[];
  rejected: PlacementRejection[];
};

export const QUEUE_PRIORITY_FLOOR: Record<ComputeQueueClass, number> = {
  interactive: 1000,
  creative: 700,
  render: 500,
  background: 300,
  maintenance: 100,
};

export function defaultQueueForKind(kind: ComputeWorkloadKind): ComputeQueueClass {
  switch (kind) {
    case 'llm-interactive':
    case 'character-runtime':
      return 'interactive';
    case 'image-generation':
    case 'video-generation':
    case 'audio-generation':
    case 'foley-generation':
    case 'voice-generation':
      return 'creative';
    case 'render':
    case 'transcode':
    case 'three-d':
      return 'render';
    case 'training':
    case 'batch-analysis':
      return 'background';
    case 'memory-index':
    case 'embedding':
      return 'maintenance';
  }
}

export function normalizeWorkloadPriority(
  queue: ComputeQueueClass,
  requestedPriority?: number,
): number {
  return Math.max(QUEUE_PRIORITY_FLOOR[queue], requestedPriority ?? 0);
}
