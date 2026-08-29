import type { CapabilityDefinition, CapabilityRegistry } from "../../jhadina-capability-registry/src";
import type { CapabilityInvocation } from "./command-contract";

export function resolveCapability(
  registry: CapabilityRegistry,
  invocation: CapabilityInvocation,
): CapabilityDefinition {
  const definition = registry.get(invocation.capability);
  if (!definition) throw new Error(`Unknown capability: ${invocation.capability}`);
  if (definition.version !== invocation.version) {
    throw new Error(`Capability version mismatch: ${invocation.capability}`);
  }
  if (definition.risk !== invocation.risk) {
    throw new Error(`Capability risk mismatch: ${invocation.capability}`);
  }
  return definition;
}
