import type { CapabilityRisk } from "@jhadina/capability-registry";
import type { AdapterStatus, MerchantConnection } from "@jhadina/commerce-adapters";

export interface CommerceCapabilityBinding {
  capabilityName: string;
  capabilityVersion: number;
  provider: string;
  connectionId: string;
  adapterName: string;
  adapterStatus: AdapterStatus;
  declaredRisk: CapabilityRisk;
  boundAt: string;
}

export interface CommerceCapabilityRequest {
  capabilityName: string;
  minimumVersion?: number;
  connectionId?: string;
}

export interface CommerceCapabilityResolution {
  available: boolean;
  binding?: CommerceCapabilityBinding;
  reason?: "not_registered" | "no_provider" | "version_mismatch" | "connection_unavailable" | "risk_mismatch";
}

export interface CommerceCapabilityBinder {
  bind(
    connection: MerchantConnection,
    capabilityName: string,
    capabilityVersion: number,
    adapterName: string,
    declaredRisk: CapabilityRisk,
  ): CommerceCapabilityBinding;

  resolve(request: CommerceCapabilityRequest): CommerceCapabilityResolution;
}
