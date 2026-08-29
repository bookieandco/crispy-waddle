import type { CapabilityRegistry } from "../../jhadina-capability-registry/src";
import type { CapabilityDefinition } from "../../jhadina-capability-registry/src";

export const LOOK_AT_SCREEN_CAPABILITY: CapabilityDefinition = Object.freeze({
  name: "perception.look_at_screen",
  description: "Observe the currently permitted screen source on explicit request.",
  risk: "read",
  version: 1,
});

export function registerLookAtScreenCapability(registry: CapabilityRegistry): void {
  if (!registry.has(LOOK_AT_SCREEN_CAPABILITY.name)) {
    registry.register(LOOK_AT_SCREEN_CAPABILITY);
  }
}
