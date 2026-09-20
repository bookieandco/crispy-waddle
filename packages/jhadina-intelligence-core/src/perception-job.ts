import type { AssetIntelligencePacket } from "./media-pipeline.js";
import type { RegisteredIntelligenceAsset } from "./asset-registry.js";
import type { SubsystemDispatchResult } from "./subsystem-dispatcher.js";

export type PerceptionJobStatus =
  | "queued"
  | "running"
  | "retry_wait"
  | "completed"
  | "failed";

export interface PerceptionJob {
  readonly id: string;
  readonly actorId: string;
  readonly assetId: string;
  readonly intent?: string;
  readonly status: PerceptionJobStatus;
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly availableAt: string;
  readonly leaseOwner?: string;
  readonly leaseToken?: string;
  readonly leaseExpiresAt?: string;
  readonly lastError?: string;
  readonly packet?: AssetIntelligencePacket;
  readonly dispatch?: SubsystemDispatchResult;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PerceptionJobRepository {
  enqueue(input: {
    id: string;
    actorId: string;
    assetId: string;
    intent?: string;
    maxAttempts: number;
  }): Promise<PerceptionJob>;
  claimNext(workerId: string, leaseMs: number): Promise<PerceptionJob | undefined>;
  renewLease(jobId: string, workerId: string, leaseToken: string, leaseMs: number): Promise<PerceptionJob | undefined>;
  complete(input: {
    jobId: string;
    workerId: string;
    leaseToken: string;
    packet: AssetIntelligencePacket;
    dispatch: SubsystemDispatchResult;
  }): Promise<PerceptionJob | undefined>;
  retry(input: {
    jobId: string;
    workerId: string;
    leaseToken: string;
    error: string;
    availableAt: string;
  }): Promise<PerceptionJob | undefined>;
  fail(input: {
    jobId: string;
    workerId: string;
    leaseToken: string;
    error: string;
  }): Promise<PerceptionJob | undefined>;
  get(actorId: string, jobId: string): Promise<PerceptionJob | undefined>;
}

export interface PerceptionJobAssetRepository {
  get(actorId: string, assetId: string): Promise<RegisteredIntelligenceAsset | undefined>;
}

export function perceptionJobId(actorId: string, assetId: string): string {
  if (!actorId.trim()) throw new Error("PERCEPTION_JOB_ACTOR_REQUIRED");
  if (!assetId.trim()) throw new Error("PERCEPTION_JOB_ASSET_REQUIRED");
  return `perception:${actorId}:${assetId}`;
}

export function retryDelayMs(attempt: number): number {
  if (!Number.isInteger(attempt) || attempt < 1) throw new Error("PERCEPTION_JOB_ATTEMPT_INVALID");
  return Math.min(15 * 60_000, 5_000 * 2 ** Math.min(8, attempt - 1));
}
