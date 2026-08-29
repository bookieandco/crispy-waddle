import type { ActionHandler } from "../../jhadina-action-core/src";
import type { CapabilityRegistry } from "../../jhadina-capability-registry/src";
import { LOOK_AT_SCREEN_CAPABILITY, registerLookAtScreenCapability } from "./look-capability";
import type { LookAtScreenAction, LookAtScreenActionHandler } from "./look-action-handler";

export interface LookCapabilityRegistration {
  capability: typeof LOOK_AT_SCREEN_CAPABILITY;
  handler: ActionHandler<LookAtScreenAction, unknown>;
}

export function registerLookCapability(
  capabilities: CapabilityRegistry,
  handler: LookAtScreenActionHandler,
): LookCapabilityRegistration {
  registerLookAtScreenCapability(capabilities);
  return { capability: LOOK_AT_SCREEN_CAPABILITY, handler };
}
