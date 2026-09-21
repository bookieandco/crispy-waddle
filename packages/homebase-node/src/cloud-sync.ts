export type CloudProvider = "jhadina-cloud" | "icloud" | "s3-compatible" | "other";

export type SyncDirection = "pull" | "push" | "bidirectional";

export interface CloudObjectRef {
  provider: CloudProvider;
  objectId: string;
  version?: string;
  contentHash?: string;
  sizeBytes?: number;
  encrypted: boolean;
  updatedAt?: string;
}

export interface SyncPolicy {
  provider: CloudProvider;
  direction: SyncDirection;
  include: string[];
  exclude: string[];
  maxObjectBytes?: number;
  requireEncryption: boolean;
}

export interface SyncPlan {
  source: CloudObjectRef;
  destination: CloudObjectRef;
  action: "copy" | "skip" | "replace" | "conflict";
  reason: string;
}

export interface CloudSyncAdapter {
  provider: CloudProvider;
  authenticate(): Promise<void>;
  plan(policy: SyncPolicy): Promise<SyncPlan[]>;
  execute(plan: SyncPlan[]): Promise<void>;
  disconnect(): Promise<void>;
}

export interface ConflictRecord {
  objectId: string;
  localHash?: string;
  remoteHash?: string;
  detectedAt: string;
  resolution: "pending" | "keep-local" | "keep-remote" | "keep-both";
}
