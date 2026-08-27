export interface ComputeResource {
  id: string;
  kind: "cpu" | "gpu" | "npu" | "memory" | "storage";
  capacity: number;
  unit: string;
  available: number;
}

export interface ServiceHealth {
  id: string;
  status: "healthy" | "degraded" | "offline";
  version?: string;
  checkedAt: string;
}

export interface HomebaseServerProfile {
  nodeId: string;
  resources: ComputeResource[];
  services: ServiceHealth[];
  capabilities: string[];
  updatedAt: string;
}

export type WorkloadClass = "jhadina-core" | "inference" | "vision" | "media" | "indexing" | "backup" | "mining";

export interface WorkloadPolicy {
  class: WorkloadClass;
  priority: number;
  maxResourceFraction: number;
  allowedWhenBatteryBacked: boolean;
  allowedWhenJhadinaBusy: boolean;
}
