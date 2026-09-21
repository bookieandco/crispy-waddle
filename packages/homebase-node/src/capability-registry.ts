export type CapabilityRisk = "read" | "write" | "destructive" | "network";

export interface HomebaseCapability {
  id: string;
  name: string;
  version: string;
  provider: string;
  risk: CapabilityRisk[];
  offline: boolean;
  requiresNetwork: boolean;
  enabled: boolean;
}

export interface CapabilityPolicy {
  capabilityId: string;
  allowOffline: boolean;
  requireUserApproval: boolean;
  allowWrite: boolean;
  allowDestructive: boolean;
}

export interface CapabilityRegistry {
  list(): Promise<HomebaseCapability[]>;
  policies(): Promise<CapabilityPolicy[]>;
  isAllowed(capabilityId: string, offline: boolean, destructive?: boolean): Promise<boolean>;
}
