import { PinocchioProvider, RigNetProvider, RigProviderOrchestrator } from "./rig-provider-adapters";

export function createRigProviderOrchestrator(): RigProviderOrchestrator {
  return new RigProviderOrchestrator([
    new RigNetProvider(),
    new PinocchioProvider(),
  ]);
}
