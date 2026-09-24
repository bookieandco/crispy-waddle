import type { CapabilityDefinition, CapabilityRegistry } from "@jhadina/capability-registry";
import type { AdapterStatus, MerchantConnection } from "@jhadina/commerce-adapters";
import type {
  CommerceCapabilityBinding,
  CommerceCapabilityBinder,
  CommerceCapabilityRequest,
  CommerceCapabilityResolution,
} from "@jhadina/opportunity-contracts";

const EXECUTABLE_STATUSES: ReadonlySet<AdapterStatus> = new Set(["active"]);

export class DeterministicCommerceCapabilityBinder implements CommerceCapabilityBinder {
  private readonly bindings = new Map<string, CommerceCapabilityBinding>();

  constructor(private readonly registry: CapabilityRegistry) {}

  bind(
    connection: MerchantConnection,
    capabilityName: string,
    capabilityVersion: number,
    adapterName: string,
    declaredRisk: CapabilityDefinition["risk"],
  ): CommerceCapabilityBinding {
    const definition = this.registry.get(capabilityName);
    if (!definition) throw new Error(`Capability is not registered: ${capabilityName}`);
    if (definition.version !== capabilityVersion) {
      throw new Error(`Capability version mismatch: ${capabilityName}`);
    }
    if (!connection.capabilities.includes(capabilityName)) {
      throw new Error(`Capability is not declared by connection: ${capabilityName}`);
    }
    if (!EXECUTABLE_STATUSES.has(connection.status)) {
      throw new Error(`Connection is not executable: ${connection.status}`);
    }
    if (declaredRisk !== definition.risk) {
      throw new Error(`Capability risk mismatch: ${capabilityName}`);
    }

    const binding: CommerceCapabilityBinding = {
      capabilityName,
      capabilityVersion,
      provider: connection.provider,
      connectionId: connection.connectionId,
      adapterName,
      adapterStatus: connection.status,
      declaredRisk: definition.risk,
      boundAt: new Date().toISOString(),
    };
    this.bindings.set(this.key(connection.connectionId, capabilityName), binding);
    return binding;
  }

  resolve(request: CommerceCapabilityRequest): CommerceCapabilityResolution {
    const definition = this.registry.get(request.capabilityName);
    if (!definition) return { available: false, reason: "not_registered" };

    const candidates = [...this.bindings.values()].filter(
      (binding) =>
        binding.capabilityName === request.capabilityName &&
        (!request.connectionId || binding.connectionId === request.connectionId),
    );

    if (candidates.length === 0) {
      return { available: false, reason: "no_provider" };
    }

    const compatible = candidates.find(
      (binding) =>
        binding.capabilityVersion >= (request.minimumVersion ?? definition.version) &&
        EXECUTABLE_STATUSES.has(binding.adapterStatus),
    );
    if (!compatible) return { available: false, reason: "version_mismatch" };
    if (compatible.declaredRisk !== definition.risk) {
      return { available: false, reason: "risk_mismatch" };
    }
    return { available: true, binding: compatible };
  }

  private key(connectionId: string, capabilityName: string): string {
    return `${connectionId}:${capabilityName}`;
  }
}

export type { CommerceCapabilityBinding, CommerceCapabilityRequest, CommerceCapabilityResolution };
