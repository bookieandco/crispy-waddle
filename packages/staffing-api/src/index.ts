import type { PlacementDependencies } from "../../placement-core/src/composition.js";
import { composePlacementCommands } from "../../placement-core/src/composition.js";
import type { PlacementActor } from "../../placement-core/src/command-api.js";

export interface StaffingRequestContext {
  actor: PlacementActor;
  requestId: string;
}

export function composeStaffingApi(
  dependencies: PlacementDependencies,
) {
  return composePlacementCommands(dependencies);
}
